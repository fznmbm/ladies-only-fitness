import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDay,
  formatTime,
  monthStart,
  weekStart,
} from "@/lib/dates";
import { planLine } from "@/lib/coverage";
import { pounds } from "@/lib/money";
import {
  addWalkIn,
  allowOverPlan,
  cashExtra,
  cashPlan,
  payLater,
  setCancelled,
  toggleHere,
  undoHere,
} from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";
import type {
  Attendance,
  Member,
  Plan,
  Session,
  Subscription,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

function DoorBox({
  a,
  member,
  allowance,
  plans,
}: {
  a: Attendance;
  member: Member;
  allowance: number;
  plans: Plan[];
}) {
  const first = member.name.split(" ")[0];

  if (a.flag === "over_plan") {
    return (
      <div className="door">
        <p className="door-title">
          {first} has used her {allowance}{" "}
          {allowance === 1 ? "session" : "sessions"} this week.
        </p>
        <form action={allowOverPlan}>
          <Hidden name="attendanceId" value={a.id} />
          <SubmitButton
            className="btn btn-primary btn-block"
            pendingText="Saving…"
          >
            Allow this time
          </SubmitButton>
        </form>
        <form action={cashExtra}>
          <Hidden name="attendanceId" value={a.id} />
          <input
            name="amount"
            inputMode="decimal"
            placeholder="£ cash received"
            aria-label="Cash received in pounds"
            required
          />
          <SubmitButton
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
            pendingText="Saving…"
          >
            Record cash
          </SubmitButton>
        </form>
        <form action={undoHere}>
          <Hidden name="attendanceId" value={a.id} />
          <SubmitButton
            className="btn btn-outline-brick btn-block"
            pendingText="Undoing…"
          >
            Not today (undo)
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="door">
      <p className="door-title">
        {first} has no plan this month. Record cash for:
      </p>
      {plans.map((p) => (
        <form key={p.id} action={cashPlan}>
          <Hidden name="attendanceId" value={a.id} />
          <Hidden name="sessionId" value={a.session_id} />
          <Hidden name="memberId" value={member.id} />
          <Hidden name="planId" value={p.id} />
          <SubmitButton
            className="btn btn-primary btn-block"
            pendingText="Saving…"
          >
            {p.name}, {pounds(p.price_pence)}
          </SubmitButton>
        </form>
      ))}
      <form action={payLater}>
        <Hidden name="attendanceId" value={a.id} />
        <SubmitButton
          className="btn btn-outline btn-block"
          pendingText="Saving…"
        >
          Pay later
        </SubmitButton>
      </form>
      <form action={undoHere}>
        <Hidden name="attendanceId" value={a.id} />
        <SubmitButton
          className="btn btn-outline-brick btn-block"
          pendingText="Undoing…"
        >
          Not today (undo)
        </SubmitButton>
      </form>
    </div>
  );
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const supabase = await createClient();

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sessionRow) notFound();
  const session = sessionRow as Session;

  const ws = weekStart(session.session_date);
  const [
    { data: membersData },
    { data: subsData },
    { data: weekSessions },
    { data: plansData },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("status", "active").order("name"),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("month", monthStart(session.session_date))
      .in("status", ["pending", "confirmed"]),
    supabase
      .from("sessions")
      .select("id")
      .gte("session_date", ws)
      .lte("session_date", addDays(ws, 6)),
    supabase
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("sort")
      .order("sessions_per_week"),
  ]);

  const weekIds = ((weekSessions ?? []) as { id: string }[]).map((s) => s.id);
  const { data: attData } = weekIds.length
    ? await supabase.from("attendance").select("*").in("session_id", weekIds)
    : { data: [] };

  const members = (membersData ?? []) as Member[];
  const plans = (plansData ?? []) as Plan[];
  const subByMember = new Map(
    ((subsData ?? []) as Subscription[]).map((s) => [s.member_id, s]),
  );
  const attByMember = new Map<string, Attendance[]>();
  for (const a of (attData ?? []) as Attendance[]) {
    attByMember.set(a.member_id, [...(attByMember.get(a.member_id) ?? []), a]);
  }

  const term = (q ?? "").trim().toLowerCase();
  const shown = members.filter(
    (m) => !term || m.name.toLowerCase().includes(term),
  );

  const hereCount = members.filter((m) =>
    (attByMember.get(m.id) ?? []).some((a) => a.session_id === id),
  ).length;
  const undecided = members.filter((m) =>
    (attByMember.get(m.id) ?? []).some(
      (a) => a.session_id === id && a.flag && !a.resolution,
    ),
  ).length;

  return (
    <>
      <Link href="/sessions" className="back" style={{ marginTop: 8 }}>
        <Icon name="back" /> Sessions
      </Link>
      <PageHead
        title="Register"
        sub={`${formatDay(session.session_date)}, ${formatTime(session.start_time)}`}
      >
        <div className="cluster" style={{ marginTop: 12 }}>
          <span className="chip chip-solid">{hereCount} here</span>
          {undecided > 0 ? (
            <span className="chip chip-warn">{undecided} to decide</span>
          ) : null}
          {session.cancelled ? (
            <span className="chip chip-warn">Cancelled</span>
          ) : null}
        </div>
      </PageHead>

      <form method="get" role="search" style={{ marginBottom: 14 }}>
        <input
          name="q"
          type="search"
          placeholder="Search name"
          defaultValue={q ?? ""}
          aria-label="Search by name"
        />
      </form>

      {members.length === 0 ? (
        <div className="card empty stack" style={{ alignItems: "center" }}>
          <p>No members yet. Add the ladies first, or add a walk-in below.</p>
          <Link href="/members" className="btn btn-primary">
            Go to members
          </Link>
        </div>
      ) : (
        <ul className="list">
          {shown.map((m) => {
            const mine = attByMember.get(m.id) ?? [];
            const here = mine.find((a) => a.session_id === id) ?? null;
            const sub = subByMember.get(m.id) ?? null;
            const line = planLine(sub, mine.length, here);
            const needsDecision = !!here && !!here.flag && !here.resolution;
            return (
              <li key={m.id}>
                <div className="row-main">
                  <Avatar name={m.name} />
                  <div className="grow">
                    <div className="name">{m.name}</div>
                    <div
                      className={
                        line.tone === "ok" ? "sub" : `sub ${line.tone}`
                      }
                    >
                      {line.text}
                    </div>
                  </div>
                  <form action={toggleHere}>
                    <Hidden name="sessionId" value={id} />
                    <Hidden name="memberId" value={m.id} />
                    <SubmitButton
                      className={here ? "btn btn-primary" : "btn btn-outline"}
                      aria-pressed={!!here}
                      aria-label={
                        here
                          ? `${m.name} is here. Tap to undo.`
                          : `Mark ${m.name} as here`
                      }
                      pendingText="…"
                    >
                      {here ? <Icon name="check" size={18} /> : null}
                      Here
                    </SubmitButton>
                  </form>
                </div>
                {needsDecision && here ? (
                  <DoorBox
                    a={here}
                    member={m}
                    allowance={sub?.sessions_per_week ?? 0}
                    plans={plans}
                  />
                ) : null}
                {here && here.extra_paid_pence > 0 ? (
                  <details
                    className="details"
                    style={{ margin: "0 14px 14px" }}
                  >
                    <summary>Cash recorded by mistake?</summary>
                    <form action={undoHere}>
                      <Hidden name="attendanceId" value={here.id} />
                      <p className="small muted">
                        This removes {m.name.split(" ")[0]}&apos;s visit today.
                        Give her the {pounds(here.extra_paid_pence)} back.
                      </p>
                      <SubmitButton
                        className="btn btn-danger btn-block"
                        pendingText="Removing…"
                      >
                        Remove visit, refund {pounds(here.extra_paid_pence)}
                      </SubmitButton>
                    </form>
                  </details>
                ) : null}
              </li>
            );
          })}
          {shown.length === 0 ? (
            <li className="empty">No one called &ldquo;{q}&rdquo;.</li>
          ) : null}
        </ul>
      )}

      <div className="stack" style={{ marginTop: 20 }}>
        <details className="details">
          <summary>
            <Icon name="plus" /> Add a walk-in
          </summary>
          <form action={addWalkIn}>
            <Hidden name="sessionId" value={id} />
            <div className="field">
              <label htmlFor="walkin-name">Name</label>
              <input id="walkin-name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="walkin-phone">WhatsApp number (optional)</label>
              <input
                id="walkin-phone"
                name="phone"
                type="tel"
                inputMode="tel"
              />
            </div>
            <SubmitButton
              className="btn btn-primary btn-block"
              pendingText="Adding…"
            >
              Add and mark here
            </SubmitButton>
          </form>
        </details>

        <form action={setCancelled}>
          <Hidden name="sessionId" value={id} />
          <Hidden
            name="cancelled"
            value={session.cancelled ? "false" : "true"}
          />
          <SubmitButton
            className="btn btn-quiet btn-block"
            pendingText="Saving…"
          >
            {session.cancelled
              ? "Bring this session back"
              : "Cancel this session"}
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
