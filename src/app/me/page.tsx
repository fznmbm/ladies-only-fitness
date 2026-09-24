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

  const admin = createAdminClient();
  const today = todayISO();
  const month = monthStart(today);
  const ws = weekStart(today);

  const [{ data: subData }, { data: weekSessionsData }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("*")
      .eq("member_id", member.id)
      .eq("month", month)
      .in("status", ["pending", "confirmed"])
      .maybeSingle(),
    admin
      .from("sessions")
      .select("*")
      .gte("session_date", ws)
      .lte("session_date", addDays(ws, 6))
      .eq("cancelled", false)
      .order("session_date")
      .order("start_time"),
  ]);

  const sub = (subData ?? null) as Subscription | null;
  const weekSessions = (weekSessionsData ?? []) as Session[];
  const weekIds = weekSessions.map((s) => s.id);

  let used = 0;
  let rsvpBySession = new Map<string, boolean>();
  if (weekIds.length > 0) {
    const [{ count }, { data: rsvpData }] = await Promise.all([
      sub
        ? admin
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("member_id", member.id)
            .in("session_id", weekIds)
        : Promise.resolve({ count: 0 as number | null }),
      admin
        .from("rsvps")
        .select("*")
        .eq("member_id", member.id)
        .in("session_id", weekIds),
    ]);
    used = count ?? 0;
    rsvpBySession = new Map(
      ((rsvpData ?? []) as Rsvp[]).map((r) => [r.session_id, r.coming]),
    );
  }

  const sessions = weekSessions.filter((s) => s.session_date >= today);

  const { data: plansData } = await admin
    .from("plans")
    .select("*")
    .eq("active", true)
    .order("sort")
    .order("sessions_per_week");
  const plans = (plansData ?? []) as Plan[];

  const bank = {
    name: process.env.BANK_ACCOUNT_NAME || "[Account name]",
    sortCode: process.env.BANK_SORT_CODE || "[Sort code]",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "[Account number]",
  };
  const payMonths = [
    { value: month, label: formatMonth(month) },
    { value: addMonths(month, 1), label: formatMonth(addMonths(month, 1)) },
  ];
  const defaultPayMonth = sub ? addMonths(month, 1) : month;

  return (
    <>
      <PageHead title={`Hello, ${member.name.split(" ")[0]}`} />

      {sub ? (
        <div className="plan-card">
          <div>
            <div className="plan-label">Your plan</div>
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
      ) : (
        <div className="note warn">
          You don&apos;t have a plan for {monthName(month)} yet. Pay by bank
          transfer, or give cash to the organiser at a session.
        </div>
      )}

      {plans.length > 0 ? (
        <>
          <h2 className="section-title">Renew or pay</h2>
          <div className="card">
            <PayForm
              plans={plans}
              bank={bank}
              months={payMonths}
              defaultMonth={defaultPayMonth}
              memberFirstName={member.name.split(" ")[0]}
            />
          </div>
        </>
      ) : null}

      <h2 className="section-title">This week</h2>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>
        Tapping is free. It only uses your plan once the organiser marks you
        here.
      </p>
      {sessions.length === 0 ? (
        <div className="card empty">
          No sessions are planned for the rest of this week.
        </div>
      ) : (
        <div className="stack">
          {sessions.map((s) => {
            const mine = rsvpBySession.get(s.id);
            const state =
              mine === true ? "yes" : mine === false ? "no" : "none";
            const otherOptions = sessions.filter(
              (o) => o.id !== s.id && rsvpBySession.get(o.id) !== false,
            );
            return (
              <div key={s.id} className="card stack">
                <div
                  className="cluster"
                  style={{ alignItems: "center", gap: 12, flexWrap: "nowrap" }}
                >
                  <span className="time">{formatTime(s.start_time)}</span>
                  <div className="grow">
                    <div className="name">{formatDay(s.session_date)}</div>
                    <div className="sub">{s.title}</div>
                  </div>
                </div>
                <RsvpButtons sessionId={s.id} state={state} />
                {state === "no" && otherOptions.length > 0 ? (
                  <div className="note">
                    <Icon name="clock" />
                    <span>
                      You can still come{" "}
                      {joinList(
                        otherOptions.map((o) => formatDate(o.session_date)),
                      )}{" "}
                      this week.
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <InstallHint />
      </div>
    </>
  );
}
