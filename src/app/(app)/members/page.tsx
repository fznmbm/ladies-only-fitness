import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  addMonths,
  formatDate,
  monthName,
  monthStart,
  todayISO,
} from "@/lib/dates";
import { addMember } from "@/app/actions";
import { whatsappUrl } from "@/lib/phone";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { RequestRow } from "@/components/LoginLink";
import { AutoRefresh } from "@/components/AutoRefresh";
import type { Member, Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

type Filter = "all" | "notpaid" | "notseen" | "owes";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; error?: string }>;
}) {
  const params = await searchParams;
  const filter = (
    ["all", "notpaid", "notseen", "owes"].includes(params.filter ?? "")
      ? params.filter
      : "all"
  ) as Filter;
  const q = (params.q ?? "").trim();

  const supabase = await createClient();
  const today = todayISO();
  const month = monthStart(today);
  const nextMonth = addMonths(month, 1);

  const [membersRes, subsRes, pastRes, attRes, pendingRes] = await Promise.all([
    supabase.from("members").select("*").eq("status", "active").order("name"),
    supabase
      .from("subscriptions")
      .select("*")
      .in("month", [month, nextMonth])
      .in("status", ["pending", "confirmed"]),
    supabase
      .from("sessions")
      .select("id")
      .lte("session_date", today)
      .eq("cancelled", false)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(3),
    supabase
      .from("attendance")
      .select("member_id, session_id, resolution, sessions!inner(session_date)")
      .gte("sessions.session_date", addDays(today, -90)),
    supabase
      .from("members")
      .select("*")
      .eq("status", "pending")
      .order("created_at"),
  ]);
  const pending = (pendingRes.data ?? []) as Member[];

  const members = (membersRes.data ?? []) as Member[];
  const subs = (subsRes.data ?? []) as Subscription[];
  const pastIds = new Set(
    ((pastRes.data ?? []) as { id: string }[]).map((s) => s.id),
  );
  const att = (attRes.data ?? []) as unknown as {
    member_id: string;
    session_id: string;
    resolution: string | null;
    sessions: { session_date: string };
  }[];

  const thisMonth = new Map<string, Subscription>();
  const renewed = new Set<string>();
  for (const s of subs) {
    if (s.month === month) thisMonth.set(s.member_id, s);
    else renewed.add(s.member_id);
  }

  const lastCame = new Map<string, string>();
  const recent = new Set<string>();
  const owes = new Map<string, number>();
  for (const a of att) {
    const d = a.sessions.session_date;
    if (!lastCame.has(a.member_id) || d > (lastCame.get(a.member_id) as string))
      lastCame.set(a.member_id, d);
    if (pastIds.has(a.session_id)) recent.add(a.member_id);
    if (a.resolution === "pay_later")
      owes.set(a.member_id, (owes.get(a.member_id) ?? 0) + 1);
  }

  const canJudgeSeen = pastIds.size >= 3;
  const tests: Record<Filter, (m: Member) => boolean> = {
    all: () => true,
    notpaid: (m) => !thisMonth.has(m.id),
    notseen: (m) => canJudgeSeen && thisMonth.has(m.id) && !recent.has(m.id),
    owes: (m) => (owes.get(m.id) ?? 0) > 0,
  };
  const counts = {
    all: members.length,
    notpaid: members.filter(tests.notpaid).length,
    notseen: members.filter(tests.notseen).length,
    owes: members.filter(tests.owes).length,
  };

  const shown = members
    .filter(tests[filter])
    .filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()));

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Everyone" },
    { key: "notpaid", label: "Not paid" },
    { key: "notseen", label: "Not seen lately" },
    { key: "owes", label: "Owes" },
  ];

  function messageFor(m: Member): string {
    const first = m.name.split(" ")[0];
    if (filter === "notseen")
      return `Hi ${first}, we've missed you at the last few sessions. Hope all is well and we'll see you soon!`;
    if (filter === "notpaid")
      return `Hi ${first}, a friendly reminder that your plan for ${monthName(month)} hasn't been paid yet. You can pay by bank transfer or cash at the next session. Thank you!`;
    if (filter === "owes")
      return `Hi ${first}, a friendly reminder about the session you attended and haven't paid for yet. You can pay by bank transfer or cash at the next session. Thank you!`;
    return `Hi ${first}, `;
  }

  return (
    <>
      <AutoRefresh seconds={20} />
      <PageHead title="Members" sub={`${members.length} in the group`} />

      {params.error ? (
        <div className="note warn" role="alert" style={{ marginBottom: 12 }}>
          {params.error.includes("members_phone_key")
            ? "Someone with that number is already a member."
            : params.error}
        </div>
      ) : null}

      {pending.length > 0 ? (
        <section style={{ marginBottom: 20 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Asking to join {pending.length}
          </h2>
          <ul className="list">
            {pending.map((r) => (
              <RequestRow key={r.id} id={r.id} name={r.name} phone={r.phone} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="stack">
        <details className="details">
          <summary>
            <Icon name="plus" /> Add a member
          </summary>
          <form action={addMember}>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="phone">WhatsApp number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="07… or +94…"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              Add member
            </button>
          </form>
        </details>

        <nav className="filters" aria-label="Filter members">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/members" : `/members?filter=${f.key}`}
              className={filter === f.key ? "filter on" : "filter"}
              aria-current={filter === f.key ? "true" : undefined}
            >
              {f.label} {counts[f.key]}
            </Link>
          ))}
        </nav>

        {filter === "notseen" ? (
          <div className="note">
            <Icon name="users" />
            <span>
              {canJudgeSeen
                ? "Paid this month, but not at any of the last 3 sessions. A friendly message often helps."
                : "This fills in once 3 sessions have been held."}
            </span>
          </div>
        ) : null}

        <form method="get" role="search">
          {filter !== "all" ? (
            <input type="hidden" name="filter" value={filter} />
          ) : null}
          <input
            name="q"
            type="search"
            placeholder="Search name"
            defaultValue={q}
            aria-label="Search by name"
          />
        </form>

        {shown.length === 0 ? (
          <div className="card empty">
            {members.length === 0
              ? "No members yet. Add the first one above."
              : "No one matches."}
          </div>
        ) : (
          <ul className="list">
            {shown.map((m) => {
              const sub = thisMonth.get(m.id);
              const last = lastCame.get(m.id);
              const owed = owes.get(m.id) ?? 0;
              const wa = whatsappUrl(m.phone, messageFor(m));
              let planText = `Not paid for ${monthName(month)}`;
              let planTone = "sub bad";
              if (sub) {
                planText = `${sub.sessions_per_week} a week, paid for ${monthName(month)}`;
                planTone = "sub";
                if (sub.status === "pending") {
                  planText += ", payment pending";
                  planTone = "sub warn";
                }
                if (renewed.has(m.id))
                  planText += `, renewed for ${monthName(nextMonth)}`;
              }
              return (
                <li key={m.id}>
                  <div className="row-main">
                    <Avatar name={m.name} />
                    <Link href={`/members/${m.id}`} className="grow row-link">
                      <div className="name">{m.name}</div>
                      <div className={planTone}>{planText}</div>
                      <div className="sub">
                        {last
                          ? `Last came ${formatDate(last)}`
                          : "No visits in the last 90 days"}
                      </div>
                      {owed > 0 ? (
                        <div className="sub bad">
                          Owes for {owed} {owed === 1 ? "session" : "sessions"}
                        </div>
                      ) : null}
                    </Link>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-small"
                      >
                        <Icon name="send" size={18} /> Message
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
