import { createClient } from "@/lib/supabase/server";
import { requireGroup } from "@/lib/groups";
import { getStaff } from "@/lib/staff";
import { addMonths, formatMonth } from "@/lib/dates";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Supabase sends at most 1,000 rows at a time, so ask page by page. */
async function everyRow<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

function cell(v: string | number): string {
  const s = String(v);
  // Quote anything with a comma, quote or new line, and stop spreadsheet
  // programs treating a cell as a formula.
  const isNumber = /^-?\d+(\.\d+)?$/.test(s);
  const safe = !isNumber && /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const money = (pence: number) => (pence / 100).toFixed(2);

/** Every payment and cost for the chosen months, as a spreadsheet (CSV). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const months = Math.min(24, Math.max(1, Number(url.searchParams.get("months")) || 1));
  if (!/^\d{4}-\d{2}-01$/.test(from)) return new Response("Bad month", { status: 400 });
  const to = addMonths(from, months); // first day after the range

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Please sign in", { status: 401 });
  if ((await getStaff())?.role !== "organiser")
    return new Response("Only the organiser can download the accounts", { status: 403 });

  const group = await requireGroup();
  const all = url.searchParams.get("scope") === "all";
  // Limits a query to the group being viewed, unless all groups were asked for.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onlyGroup = (query: any, column = "group_id") =>
    all ? query : query.eq(column, group.id);

  const [plans, door, costs, groups] = await Promise.all([
    everyRow<{
      month: string;
      confirmed_at: string | null;
      price_pence: number;
      method: string;
      sessions_per_week: number;
      members: { name: string } | null;
      groups: { name: string } | null;
    }>((a, b) =>
      onlyGroup(
        supabase
          .from("subscriptions")
          .select("month, confirmed_at, price_pence, method, sessions_per_week, members(name), groups(name)")
          .eq("status", "confirmed")
          .gte("month", from)
          .lt("month", to),
      )
        .order("month")
        .range(a, b),
    ),
    everyRow<{
      extra_paid_pence: number;
      members: { name: string } | null;
      sessions: { session_date: string; groups: { name: string } | null } | null;
    }>((a, b) =>
      onlyGroup(
        supabase
          .from("attendance")
          .select("extra_paid_pence, members(name), sessions!inner(session_date, group_id, groups(name))")
          .gt("extra_paid_pence", 0)
          .gte("sessions.session_date", from)
          .lt("sessions.session_date", to),
        "sessions.group_id",
      ).range(a, b),
    ),
    everyRow<Expense>((a, b) =>
      supabase
        .from("expenses")
        .select("*")
        .lt("covers_from", to)
        .gte("covers_from", addMonths(from, -23))
        .order("paid_on")
        .range(a, b),
    ),
    supabase.from("groups").select("id, name"),
  ]);
  const groupName = new Map(
    ((groups.data ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name]),
  );

  type Row = { date: string; type: string; group: string; who: string; detail: string; pence: number };
  const rows: Row[] = [];

  for (const p of plans) {
    rows.push({
      date: (p.confirmed_at ?? p.month).slice(0, 10),
      type: "Plan",
      group: p.groups?.name ?? "",
      who: p.members?.name ?? "",
      detail: `${p.sessions_per_week} a week for ${formatMonth(p.month)}, ${p.method === "cash" ? "cash" : "bank transfer"}`,
      pence: p.price_pence,
    });
  }
  for (const d of door) {
    rows.push({
      date: d.sessions?.session_date ?? "",
      type: "Cash at the door",
      group: d.sessions?.groups?.name ?? "",
      who: d.members?.name ?? "",
      detail: "Extra session",
      pence: d.extra_paid_pence,
    });
  }
  for (const e of costs) {
    if (!all && e.group_id !== group.id) continue;
    const base = Math.floor(e.amount_pence / e.covers_months);
    for (let i = 0; i < e.covers_months; i++) {
      const m = addMonths(e.covers_from, i);
      if (m < from || m >= to) continue;
      const share = i === 0 ? base + (e.amount_pence % e.covers_months) : base;
      rows.push({
        date: i === 0 ? e.paid_on : m,
        type: "Cost",
        group: e.group_id ? (groupName.get(e.group_id) ?? "") : "Shared",
        who: EXPENSE_CATEGORIES[e.category] ?? "Other",
        detail:
          (e.description ?? "") +
          (e.covers_months > 1 ? ` (month ${i + 1} of ${e.covers_months}, paid ${e.paid_on})` : ""),
        pence: -share,
      });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const total = rows.reduce((n, r) => n + r.pence, 0);
  const lines = [
    ["Date", "Type", "Group", "Who or what", "Details", "Amount (£)"],
    ...rows.map((r) => [r.date, r.type, r.group, r.who, r.detail, money(r.pence)]),
    [],
    ["", "", "", "", "Money in", money(rows.filter((r) => r.pence > 0).reduce((n, r) => n + r.pence, 0))],
    ["", "", "", "", "Costs", money(rows.filter((r) => r.pence < 0).reduce((n, r) => n + r.pence, 0))],
    ["", "", "", "", "Profit", money(total)],
  ];
  const csv = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";

  const label = months === 1 ? from.slice(0, 7) : `${from.slice(0, 7)}-to-${addMonths(from, months - 1).slice(0, 7)}`;
  const who = all ? "all-groups" : group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="accounts-${who}-${label}.csv"`,
      "cache-control": "no-store",
    },
  });
}
