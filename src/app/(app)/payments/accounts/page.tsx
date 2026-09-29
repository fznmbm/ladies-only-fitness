import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import {
  addMonths,
  formatDate,
  formatMonth,
  monthName,
  monthStart,
  todayISO,
} from "@/lib/dates";
import { pounds } from "@/lib/money";
import { deleteExpense } from "@/app/actions";
import { receiptViewUrl } from "@/lib/b2";
import { getGroupContext, requireGroup } from "@/lib/groups";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { PaymentsTabs } from "@/components/PaymentsTabs";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/types";
import { ExpenseForm } from "./ExpenseForm";

export const dynamic = "force-dynamic";

type MonthRow = {
  month: string;
  plans_pence: number;
  plans_cash_pence: number;
  plans_transfer_pence: number;
  plans_count: number;
  door_pence: number;
  costs_pence: number;
};

/** This expense's share of one month (bulk payments are spread evenly). */
function shareOf(e: Expense, month: string): number {
  const first = e.covers_from;
  const last = addMonths(first, e.covers_months - 1);
  if (month < first || month > last) return 0;
  const base = Math.floor(e.amount_pence / e.covers_months);
  return month === first ? base + (e.amount_pence % e.covers_months) : base;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; scope?: string }>;
}) {
  const { month: m, scope } = await searchParams;
  // Money and settings are for the organiser only.
  if ((await getStaff())?.role !== "organiser") redirect("/sessions");

  const today = todayISO();
  const thisMonth = monthStart(today);
  const month = m && /^\d{4}-\d{2}-01$/.test(m) ? m : thisMonth;
  const nextMonth = addMonths(month, 1);

  const supabase = await createClient();
  const group = await requireGroup();
  const { active } = await getGroupContext();
  const manyGroups = active.length > 1;
  const all = manyGroups && scope === "all";
  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ month, ...(all ? { scope: "all" } : {}), ...extra });
    return `/payments/accounts?${p.toString()}`;
  };

  const first12 = addMonths(month, -11);
  const [
    { data: summaryData },
    { data: expenseData },
    { count: owedCount },
    { count: memberCount },
    { count: paidCount },
  ] = await Promise.all([
    // The last 12 months up to the one being viewed, worked out in the database.
    supabase.rpc("accounts_summary", {
      p_group_id: all ? null : group.id,
      p_from: first12,
      p_months: 12,
    }),
    // Costs that could cover this month (none cover more than 24 months).
    supabase
      .from("expenses")
      .select("*")
      .lte("covers_from", month)
      .gte("covers_from", addMonths(month, -23))
      .order("paid_on", { ascending: false }),
    // "Pay later" visits this month that are still owed.
    all
      ? Promise.resolve({ count: null })
      : supabase
          .from("attendance")
          .select("id, sessions!inner(group_id, session_date)", {
            count: "exact",
            head: true,
          })
          .eq("resolution", "pay_later")
          .eq("sessions.group_id", group.id)
          .gte("sessions.session_date", month)
          .lt("sessions.session_date", nextMonth),
    all
      ? Promise.resolve({ count: null })
      : supabase
          .from("member_groups")
          .select("member_id, members!inner(status)", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("status", "active")
          .eq("members.status", "active"),
    all
      ? Promise.resolve({ count: null })
      : supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("month", month)
          .in("status", ["pending", "confirmed"]),
  ]);

  const rows = ((summaryData ?? []) as MonthRow[]).map((r) => ({
    ...r,
    income: Number(r.plans_pence) + Number(r.door_pence),
    costs: Number(r.costs_pence),
  }));
  const current = rows.find((r) => r.month === month) ?? {
    month,
    plans_pence: 0,
    plans_cash_pence: 0,
    plans_transfer_pence: 0,
    plans_count: 0,
    door_pence: 0,
    costs_pence: 0,
    income: 0,
    costs: 0,
  };
  const profit = current.income - current.costs;

  const groupName = new Map(active.map((g) => [g.id, g.name]));
  const monthCosts = ((expenseData ?? []) as Expense[])
    .map((e) => ({ e, share: shareOf(e, month) }))
    .filter(({ share }) => share > 0);
  const ownCosts = monthCosts.filter(
    ({ e }) => all || e.group_id === group.id,
  );
  const sharedCosts = all ? [] : monthCosts.filter(({ e }) => e.group_id === null);
  const sharedTotal = sharedCosts.reduce((n, c) => n + c.share, 0);

  const receiptUrls = new Map<string, string>();
  for (const { e } of [...ownCosts, ...sharedCosts]) {
    if (e.receipt_path) {
      try {
        receiptUrls.set(e.id, await receiptViewUrl(e.receipt_path));
      } catch {
        // The photo just won't show.
      }
    }
  }

  const notPaid =
    memberCount !== null && paidCount !== null
      ? Math.max(0, (memberCount ?? 0) - (paidCount ?? 0))
      : null;
  // The table starts at the first month with anything in it, so a new
  // group doesn't see a column of empty months.
  const firstUsed = rows.findIndex(
    (r) => r.income !== 0 || r.costs !== 0 || r.month === month,
  );
  const tableRows = firstUsed > 0 ? rows.slice(firstUsed) : rows;
  const year12 = rows.reduce(
    (t, r) => ({ income: t.income + r.income, costs: t.costs + r.costs }),
    { income: 0, costs: 0 },
  );
  const formMonths = Array.from({ length: 15 }, (_, i) => {
    const v = addMonths(thisMonth, i - 2);
    return { value: v, label: formatMonth(v) };
  });
  const scopeName = all ? "All groups" : group.name;
  const exportHref = (from: string, months: number) =>
    `/payments/accounts/export?${new URLSearchParams({
      from,
      months: String(months),
      ...(all ? { scope: "all" } : {}),
    }).toString()}`;

  return (
    <>
      <PageHead title="Accounts" sub={scopeName} />
      <PaymentsTabs active="accounts" />

      {manyGroups ? (
        <nav className="filters" aria-label="Which groups" style={{ marginBottom: 12 }}>
          <Link
            href={`/payments/accounts?month=${month}`}
            className={all ? "filter" : "filter on"}
          >
            {group.name}
          </Link>
          <Link
            href={`/payments/accounts?month=${month}&scope=all`}
            className={all ? "filter on" : "filter"}
          >
            All groups
          </Link>
        </nav>
      ) : null}

      <nav className="week-nav" aria-label="Choose a month">
        <Link
          href={q({ month: addMonths(month, -1) })}
          className="btn btn-quiet btn-small"
          aria-label="Previous month"
        >
          <Icon name="back" size={18} />
        </Link>
        <div className="week-title">
          <strong>{formatMonth(month)}</strong>
          <span>{month === thisMonth ? "This month, so far" : " "}</span>
        </div>
        <Link
          href={q({ month: addMonths(month, 1) })}
          className="btn btn-quiet btn-small"
          aria-label="Next month"
        >
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="back" size={18} />
          </span>
        </Link>
      </nav>

      <div className="money-tiles">
        <div className="money-tile">
          <span>Money in</span>
          <strong>{pounds(current.income)}</strong>
        </div>
        <div className="money-tile">
          <span>Costs</span>
          <strong>{pounds(current.costs)}</strong>
        </div>
        <div className={profit < 0 ? "money-tile loss" : "money-tile profit"}>
          <span>{profit < 0 ? "Loss" : "Profit"}</span>
          <strong>{pounds(Math.abs(profit))}</strong>
        </div>
      </div>

      <h2 className="section-title">Money in</h2>
      <ul className="list">
        <li className="row-main">
          <div className="grow">
            <div className="name">Plans</div>
            <div className="sub">
              {current.plans_count} paid for {monthName(month)}:{" "}
              {pounds(Number(current.plans_transfer_pence))} by transfer,{" "}
              {pounds(Number(current.plans_cash_pence))} cash
            </div>
          </div>
          <div className="name">{pounds(Number(current.plans_pence))}</div>
        </li>
        <li className="row-main">
          <div className="grow">
            <div className="name">Cash at the door</div>
            <div className="sub">Extra sessions paid on the day</div>
          </div>
          <div className="name">{pounds(Number(current.door_pence))}</div>
        </li>
        {notPaid !== null ? (
          <li className="row-main">
            <div className="grow">
              <div className="name">Still to come in</div>
              <div className="sub">
                {notPaid === 0
                  ? `Everyone has paid for ${monthName(month)}`
                  : `${notPaid} ${notPaid === 1 ? "lady hasn't" : "ladies haven't"} paid for ${monthName(month)}`}
                {(owedCount ?? 0) > 0
                  ? `, ${owedCount} "pay later" ${owedCount === 1 ? "visit" : "visits"} owed`
                  : ""}
              </div>
            </div>
            <Link href="/members?filter=notpaid" className="btn btn-quiet btn-small">
              See who
            </Link>
          </li>
        ) : null}
      </ul>
      <p className="small muted" style={{ marginTop: 8 }}>
        Plans count in the month they&apos;re for, once confirmed.
      </p>

      <h2 className="section-title">Costs</h2>
      {ownCosts.length === 0 ? (
        <div className="card empty">No costs recorded for {monthName(month)}.</div>
      ) : (
        <ul className="list">
          {ownCosts.map(({ e, share }) => {
            const url = receiptUrls.get(e.id);
            const spread = e.covers_months > 1;
            return (
              <li key={e.id}>
                {/* Tap a cost to see the option to remove it. */}
                <details className="fold-row">
                  <summary className="row-main">
                    <div className="grow">
                      <div className="name">
                        {e.description || EXPENSE_CATEGORIES[e.category] || "Other"}
                      </div>
                      <div className="sub">
                        {e.description
                          ? `${EXPENSE_CATEGORIES[e.category] ?? "Other"} · `
                          : ""}
                        paid {formatDate(e.paid_on)}
                        {spread
                          ? `, ${pounds(e.amount_pence)} over ${e.covers_months} months`
                          : ""}
                        {all
                          ? `, ${e.group_id ? (groupName.get(e.group_id) ?? "old group") : "shared"}`
                          : ""}
                        {url ? (
                          <>
                            {", "}
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              receipt
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="name">{pounds(share)}</div>
                  </summary>
                  <form action={deleteExpense} className="fold-body">
                    <input type="hidden" name="id" value={e.id} />
                    <span className="small muted grow">Added by mistake?</span>
                    <ConfirmSubmit
                      className="btn btn-danger btn-small"
                      confirm={`Remove this ${pounds(e.amount_pence)} cost${spread ? ` (from all ${e.covers_months} months)` : ""}?`}
                    >
                      Remove cost
                    </ConfirmSubmit>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {sharedCosts.length > 0 ? (
        <p className="small muted" style={{ marginTop: 8 }}>
          Plus {pounds(sharedTotal)} of costs shared by all groups, counted
          under{" "}
          <Link href={`/payments/accounts?month=${month}&scope=all`}>All groups</Link>.
        </p>
      ) : null}

      <details className="details" style={{ marginTop: 12 }}>
        <summary>
          <Icon name="plus" /> Add a cost
        </summary>
        <div className="body">
          <ExpenseForm
            groupName={group.name}
            manyGroups={manyGroups}
            months={formMonths}
            defaultMonth={
              formMonths.some((x) => x.value === month) ? month : thisMonth
            }
            today={today}
          />
        </div>
      </details>

      <h2 className="section-title" style={{ marginTop: 28 }}>
        {tableRows.length < rows.length ? "Month by month" : "Last 12 months"}
      </h2>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="money-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">In</th>
              <th scope="col">Costs</th>
              <th scope="col">Profit</th>
            </tr>
          </thead>
          <tbody>
            {[...tableRows].reverse().map((r) => {
              const p = r.income - r.costs;
              return (
                <tr key={r.month} className={r.month === month ? "on" : undefined}>
                  <th scope="row">
                    <Link href={q({ month: r.month })}>
                      {formatMonth(r.month).replace(/ \d{4}$/, "")}{" "}
                      <span className="muted">{r.month.slice(2, 4)}</span>
                    </Link>
                  </th>
                  <td>{pounds(r.income)}</td>
                  <td>{pounds(r.costs)}</td>
                  <td className={p < 0 ? "loss" : undefined}>
                    {p < 0 ? "−" : ""}
                    {pounds(Math.abs(p))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{pounds(year12.income)}</td>
              <td>{pounds(year12.costs)}</td>
              <td className={year12.income - year12.costs < 0 ? "loss" : undefined}>
                {year12.income - year12.costs < 0 ? "−" : ""}
                {pounds(Math.abs(year12.income - year12.costs))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h2 className="section-title">Download</h2>
      <div className="card stack">
        <p className="small muted">
          A spreadsheet of every payment and cost, for your records or tax
          return. Opens in Excel, Numbers or Google Sheets.
        </p>
        <a href={exportHref(month, 1)} className="btn btn-outline btn-block" download>
          {formatMonth(month)}
        </a>
        <a href={exportHref(first12, 12)} className="btn btn-outline btn-block" download>
          12 months to {formatMonth(month)}
        </a>
        <p className="small muted">
          For Self Assessment (the tax year runs April to April), go to March
          and download the 12 months.
        </p>
      </div>
    </>
  );
}
