import { createAdminClient } from "@/lib/supabase/admin";
import { getMember } from "@/lib/memberAuth";
import {
  addDays,
  addMonths,
  formatDate,
  formatDay,
  formatMonth,
  formatTime,
  lastDayOfMonth,
  monthName,
  monthStart,
  todayISO,
  weekStart,
} from "@/lib/dates";
import { PageHead } from "@/components/PageHead";
import { InstallHint } from "@/components/InstallHint";
import { RsvpButtons } from "@/components/RsvpButtons";
import { PayForm } from "@/components/PayForm";
import { Icon } from "@/components/Icon";
import type { Plan, Rsvp, Session, Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export default async function MePage() {
  const admin = createAdminClient();
  const today = todayISO();
  const month = monthStart(today);
  const ws = weekStart(today);
  const nextWs = addDays(ws, 7);

  const member = await getMember();
  if (!member) {
    return (
      <>
        <PageHead title="This link isn't working" />
        <div className="note warn">
          Your personal link may be old or incomplete. Message the organiser on
          WhatsApp and ask for a new one.
        </div>
      </>
    );
  }

  // Round 1: her groups, her visits this week and her "I'm coming" answers.
  // Everything is limited to this one lady and the groups she belongs to.
  const [{ data: groupRows }, { data: visitData }, { data: rsvpData }] =
    await Promise.all([
      admin
        .from("member_groups")
        .select("group_id, groups(id, name, sort, active)")
        .eq("member_id", member.id)
        .eq("status", "active"),
      admin
        .from("attendance")
        .select("session_id, sessions!inner(session_date, group_id)")
        .eq("member_id", member.id)
        .gte("sessions.session_date", ws)
        .lt("sessions.session_date", nextWs),
      admin
        .from("rsvps")
        .select("session_id, coming, sessions!inner(session_date)")
        .eq("member_id", member.id)
        .gte("sessions.session_date", ws)
        .lte("sessions.session_date", addDays(ws, 13)),
    ]);
  const groups = (
    (groupRows ?? []) as unknown as {
      groups: { id: string; name: string; sort: number; active: boolean } | null;
    }[]
  )
    .map((r) => r.groups)
    .filter((g): g is { id: string; name: string; sort: number; active: boolean } => !!g && g.active)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const groupIds = groups.map((g) => g.id);
  const manyGroups = groups.length > 1;
  const nameOf = new Map(groups.map((g) => [g.id, g.name]));

  if (groups.length === 0) {
    return (
      <>
        <PageHead title={`Hello, ${member.name.split(" ")[0]}`} />
        <div className="note">
          You&apos;re not in a group at the moment. Message the organiser on
          WhatsApp if you&apos;d like to come to sessions.
        </div>
      </>
    );
  }

  // Round 2: the sessions, plans and payments for her groups.
  const [{ data: sessionData }, { data: plansData }, { data: subData }] =
    await Promise.all([
      // This week's and next week's sessions, cancelled ones included so she
      // can see what changed.
      admin
        .from("sessions")
        .select("*")
        .in("group_id", groupIds)
        .gte("session_date", ws)
        .lte("session_date", addDays(ws, 13))
        .order("session_date")
        .order("start_time"),
      admin
        .from("plans")
        .select("*")
        .in("group_id", groupIds)
        .eq("active", true)
        .order("sort")
        .order("sessions_per_week"),
      admin
        .from("subscriptions")
        .select("*")
        .eq("member_id", member.id)
        .in("group_id", groupIds)
        .in("month", [month, addMonths(month, 1)])
        .in("status", ["pending", "confirmed"]),
    ]);

  const twoWeeks = (sessionData ?? []) as Session[];
  const plans = (plansData ?? []) as Plan[];
  const subs = (subData ?? []) as Subscription[];
  // Sessions of each group she has been marked at this week.
  const usedByGroup = new Map<string, number>();
  for (const v of (visitData ?? []) as unknown as {
    sessions: { group_id: string } | null;
  }[]) {
    const g = v.sessions?.group_id;
    if (g) usedByGroup.set(g, (usedByGroup.get(g) ?? 0) + 1);
  }
  const rsvpBySession = new Map(
    ((rsvpData ?? []) as Pick<Rsvp, "session_id" | "coming">[]).map((r) => [
      r.session_id,
      r.coming,
    ]),
  );
  const thisMonthSub = new Map(
    subs.filter((s) => s.month === month).map((s) => [s.group_id, s]),
  );

  const thisWeek = twoWeeks.filter(
    (s) => s.session_date >= today && s.session_date < nextWs,
  );
  const nextWeek = twoWeeks.filter((s) => s.session_date >= nextWs);

  // One session card with her "I'm coming" buttons. If she can't make it,
  // it suggests the other sessions of the same group she can still come to
  // that week. Cancelled sessions show why, with no buttons.
  const sessionCard = (s: Session, sameWeek: Session[], weekWord: string) => {
    const mine = rsvpBySession.get(s.id);
    const state = mine === true ? "yes" : mine === false ? "no" : "none";
    const otherOptions = sameWeek.filter(
      (o) =>
        o.id !== s.id &&
        !o.cancelled &&
        o.group_id === s.group_id &&
        rsvpBySession.get(o.id) !== false,
    );
    return (
      <div
        key={s.id}
        className="card stack"
        style={s.cancelled ? { opacity: 0.75 } : undefined}
      >
        <div
          className="cluster"
          style={{ alignItems: "center", gap: 12, flexWrap: "nowrap" }}
        >
          <span className="time">{formatTime(s.start_time)}</span>
          <div className="grow">
            <div className="name">{formatDay(s.session_date)}</div>
            <div className="sub">
              {s.title}
              {manyGroups ? `, ${nameOf.get(s.group_id) ?? ""}` : ""}
            </div>
          </div>
          {s.cancelled ? <span className="chip chip-warn">Cancelled</span> : null}
        </div>
        {s.cancelled ? (
          s.cancel_reason ? (
            <p className="small muted">{s.cancel_reason}</p>
          ) : null
        ) : (
          <>
            <RsvpButtons sessionId={s.id} state={state} />
            {state === "no" && otherOptions.length > 0 ? (
              <div className="note">
                <Icon name="clock" />
                <span>
                  You can still come{" "}
                  {joinList(otherOptions.map((o) => formatDate(o.session_date)))}{" "}
                  {weekWord}.
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  const bank = {
    name: process.env.BANK_ACCOUNT_NAME || "[Account name]",
    sortCode: process.env.BANK_SORT_CODE || "[Sort code]",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "[Account number]",
  };
  const payMonths = [
    { value: month, label: formatMonth(month) },
    { value: addMonths(month, 1), label: formatMonth(addMonths(month, 1)) },
  ];
  // Paid for this month in every group already? Then offer next month first.
  const allPaid = groups.every((g) => thisMonthSub.has(g.id));
  const defaultPayMonth = allPaid ? addMonths(month, 1) : month;

  return (
    <>
      <PageHead title={`Hello, ${member.name.split(" ")[0]}`} />

      <div className="stack">
        {groups.map((g) => {
          const sub = thisMonthSub.get(g.id);
          const used = usedByGroup.get(g.id) ?? 0;
          if (!sub) {
            return (
              <div key={g.id} className="note warn">
                You don&apos;t have a {manyGroups ? `${g.name} ` : ""}plan for{" "}
                {monthName(month)} yet. Pay by bank transfer, or give cash to the
                organiser at a session.
              </div>
            );
          }
          return (
            <div key={g.id} className="plan-card">
              <div>
                <div className="plan-label">
                  {manyGroups ? `Your ${g.name} plan` : "Your plan"}
                </div>
                <div className="plan-big">{sub.sessions_per_week} a week</div>
                <div
                  className="dots"
                  aria-label={`${used} of ${sub.sessions_per_week} used this week`}
                >
                  {Array.from({ length: sub.sessions_per_week }, (_, i) => (
                    <span key={i} className={i < used ? "dot used" : "dot"} />
                  ))}
                  <span className="dots-text">
                    {used} of {sub.sessions_per_week} used this week
                  </span>
                </div>
                <div className="plan-foot">
                  {sub.status === "pending"
                    ? "Waiting for the organiser to confirm your payment."
                    : `Runs until ${formatDay(lastDayOfMonth(today)).replace(/^\w+ /, "")}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {plans.length > 0 ? (
        <>
          <h2 className="section-title">Renew or pay</h2>
          <div className="card">
            <PayForm
              plans={plans}
              groups={groups.map((g) => ({ id: g.id, name: g.name }))}
              bank={bank}
              months={payMonths}
              defaultMonth={defaultPayMonth}
              payRef={member.pay_ref ?? member.name.split(" ")[0]}
            />
          </div>
        </>
      ) : null}

      <h2 className="section-title">This week</h2>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>
        Tapping is free. It only uses your plan once the organiser marks you
        here.
      </p>
      {thisWeek.length === 0 ? (
        <div className="card empty">No more sessions this week.</div>
      ) : (
        <div className="stack">
          {thisWeek.map((s) => sessionCard(s, thisWeek, "this week"))}
        </div>
      )}

      <h2 className="section-title">Next week</h2>
      {nextWeek.length === 0 ? (
        <div className="card empty">
          Next week&apos;s sessions aren&apos;t up yet.
        </div>
      ) : (
        <div className="stack">
          {nextWeek.map((s) => sessionCard(s, nextWeek, "next week"))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <InstallHint />
      </div>
    </>
  );
}
