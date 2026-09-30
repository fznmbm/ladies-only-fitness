import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDay,
  formatTime,
  monthStart,
  todayISO,
  weekStart,
} from "@/lib/dates";
import { planLine } from "@/lib/coverage";
import { pounds } from "@/lib/money";
import {
  addWalkIn,
  allowOverPlan,
  cashExtra,
  cashPlan,
  cancelSession,
  moveSession,
  payLater,
  restoreSession,
  toggleHere,
  undoHere,
} from "@/app/actions";
import { getGroupContext } from "@/lib/groups";
import { getStaff } from "@/lib/staff";
import { ShareToWhatsApp } from "@/components/ShareToWhatsApp";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
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

/** "Record cash" with the amount typed in, pre-filled with the single session price. */
function CashAmount({ a, dropin }: { a: Attendance; dropin: number | null }) {
  return (
    <form action={cashExtra}>
      <Hidden name="attendanceId" value={a.id} />
      <input
        name="amount"
        inputMode="decimal"
        placeholder="£ cash received"
        aria-label="Cash received in pounds"
        defaultValue={dropin !== null ? dropin / 100 : undefined}
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
  );
}

function DoorBox({
  a,
  member,
  allowance,
  plans,
  dropin,
}: {
  a: Attendance;
  member: Member;
  allowance: number;
  plans: Plan[];
  /** Price of one session on its own, from Settings. */
  dropin: number | null;
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
        <CashAmount a={a} dropin={dropin} />
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
      <p className="door-title">{first} has no plan this month.</p>
      {/* Just today: one session paid on its own. */}
      {dropin !== null ? (
        <form action={cashExtra}>
          <Hidden name="attendanceId" value={a.id} />
          <Hidden name="amount" value={String(dropin / 100)} />
          <SubmitButton
            className="btn btn-primary btn-block"
            pendingText="Saving…"
          >
            Just this session, {pounds(dropin)}
          </SubmitButton>
        </form>
      ) : (
        <>
          <p className="door-sub">Just this session:</p>
          <CashAmount a={a} dropin={null} />
        </>
      )}
      {plans.length > 0 ? (
        <p className="door-sub">Or a plan for the month:</p>
      ) : null}
      {plans.map((p) => (
        <form key={p.id} action={cashPlan}>
          <Hidden name="attendanceId" value={a.id} />
          <Hidden name="sessionId" value={a.session_id} />
          <Hidden name="memberId" value={member.id} />
          <Hidden name="planId" value={p.id} />
          <SubmitButton
            className="btn btn-outline btn-block"
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
  searchParams: Promise<{
    q?: string;
    moved?: string;
    cancelled?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const { q, moved, cancelled: justCancelled, error } = await searchParams;
  const supabase = await createClient();

  // Round 1: the session, who said they're coming, the groups and who's signed in.
  const [{ data: sessionRow }, { data: rsvpData }, { groups }, staff] =
    await Promise.all([
      supabase.from("sessions").select("*").eq("id", id).maybeSingle(),
      supabase.from("rsvps").select("member_id, coming").eq("session_id", id),
      getGroupContext(),
      getStaff(),
    ]);
  // Helpers take the register; only the organiser moves or cancels sessions.
  const isOrganiser = staff?.role === "organiser";
  if (!sessionRow) notFound();
  const session = sessionRow as Session;
  const sessionGroup = groups.find((g) => g.id === session.group_id);
  const groupNameOf = sessionGroup?.name ?? "";
  const dropin = sessionGroup?.dropin_pence ?? null;

  // Ladies can only be marked here on the day or afterwards (to correct it),
  // never in advance, and never for a cancelled session.
  const today = todayISO();
  const isFuture = session.session_date > today;
  const isPast = session.session_date < today;
  const locked = isFuture || session.cancelled;

  // Round 2: this group's ladies, plans, payments for the month and visits
  // that week, all at once.
  const ws = weekStart(session.session_date);
  const [
    { data: membersData },
    { data: plansData },
    { data: subsData },
    { data: attData },
  ] = await Promise.all([
    supabase
      .from("member_groups")
      .select("members(*)")
      .eq("group_id", session.group_id)
      .eq("status", "active"),
    supabase
      .from("plans")
      .select("*")
      .eq("group_id", session.group_id)
      .eq("active", true)
      .order("sort")
      .order("sessions_per_week"),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("group_id", session.group_id)
      .eq("month", monthStart(session.session_date))
      .in("status", ["pending", "confirmed"]),
    supabase
      .from("attendance")
      .select("*, sessions!inner(session_date, group_id)")
      .eq("sessions.group_id", session.group_id)
      .gte("sessions.session_date", ws)
      .lte("sessions.session_date", addDays(ws, 6)),
  ]);

  const members = (
    (membersData ?? []) as unknown as { members: Member | null }[]
  )
    .map((r) => r.members)
    .filter((m): m is Member => !!m && m.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name));
  const plans = (plansData ?? []) as Plan[];
  const subByMember = new Map(
    ((subsData ?? []) as Subscription[]).map((s) => [s.member_id, s]),
  );
  const attByMember = new Map<string, Attendance[]>();
  for (const a of (attData ?? []) as Attendance[]) {
    attByMember.set(a.member_id, [...(attByMember.get(a.member_id) ?? []), a]);
  }

  // What each lady said on her own page: true = coming, false = can't make it.
  const said = new Map(
    ((rsvpData ?? []) as { member_id: string; coming: boolean }[]).map((r) => [
      r.member_id,
      r.coming,
    ]),
  );
  const comingCount = members.filter((m) => said.get(m.id) === true).length;

  const term = (q ?? "").trim().toLowerCase();
  const shown = members.filter(
    (m) => !term || m.name.toLowerCase().includes(term),
  );

  // Anyone at all marked here for this session (moving it is then not allowed).
  const anyoneHere = ((attData ?? []) as Attendance[]).some(
    (a) => a.session_id === id,
  );

  // Ready-made WhatsApp messages after moving or cancelling this session.
  const timeLabel = `${formatDay(session.session_date)} at ${formatTime(session.start_time)}`;
  let changeMessage: string | null = null;
  if (moved && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(moved)) {
    const [oldDate, oldTime] = moved.split("T");
    changeMessage =
      `Change of plan${groups.length > 1 ? ` for ${groupNameOf}` : ""}: ` +
      `the ${formatDay(oldDate)} ${formatTime(oldTime)} session is moving to ${timeLabel}.\n\n` +
      `If you're coming, please tap "I'm coming" again in your app. Thank you!`;
  } else if (justCancelled && session.cancelled) {
    changeMessage =
      `Sorry ladies, there's no session on ${timeLabel}` +
      `${session.cancel_reason ? ` (${session.cancel_reason})` : ""}.\n\n` +
      `Your plan is weekly, so you're welcome to come to another session this week instead. See you soon!`;
  }

  const hereCount = members.filter((m) =>
    (attByMember.get(m.id) ?? []).some((a) => a.session_id === id),
  ).length;
  const undecided = members.filter((m) =>
    (attByMember.get(m.id) ?? []).some(
      (a) => a.session_id === id && a.flag && !a.resolution,
    ),
  ).length;

  // One lady's row: her plan line, the Here button, and any decision to make.
  const row = (m: Member) => {
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
            <div className={line.tone === "ok" ? "sub" : `sub ${line.tone}`}>
              {line.text}
            </div>
          </div>
          <form action={toggleHere}>
            <Hidden name="sessionId" value={id} />
            <Hidden name="memberId" value={m.id} />
            <SubmitButton
              className={here ? "btn btn-primary" : "btn btn-outline"}
              disabled={locked && !here}
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
            dropin={dropin}
          />
        ) : null}
        {here && here.extra_paid_pence > 0 ? (
          <details className="details" style={{ margin: "0 14px 14px" }}>
            <summary>Cash recorded by mistake?</summary>
            <form action={undoHere}>
              <Hidden name="attendanceId" value={here.id} />
              <p className="small muted">
                This removes {m.name.split(" ")[0]}&apos;s visit today. Give her
                the {pounds(here.extra_paid_pence)} back.
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
  };

  // The ladies who said they're coming first, then everyone else, then those
  // who said they can't make it. Rows never jump about when tapped.
  // While searching, it's one plain list.
  const sections = term
    ? [{ key: "all", title: "", list: shown }]
    : [
        {
          key: "coming",
          title: "Said she's coming",
          list: shown.filter((m) => said.get(m.id) === true),
        },
        {
          key: "others",
          title: "Everyone else",
          list: shown.filter((m) => !said.has(m.id)),
        },
        {
          key: "cant",
          title: "Said she can't make it",
          list: shown.filter((m) => said.get(m.id) === false),
        },
      ];

  return (
    <>
      <Link href="/sessions" className="back" style={{ marginTop: 8 }}>
        <Icon name="back" /> Sessions
      </Link>
      <PageHead
        title="Register"
        sub={`${session.title}, ${formatDay(session.session_date)}, ${formatTime(session.start_time)}${groups.length > 1 ? ` · ${groupNameOf}` : ""}`}
      >
        <div className="cluster" style={{ marginTop: 12 }}>
          <span className="chip chip-solid">{hereCount} here</span>
          {comingCount > 0 ? (
            <span className="chip">{comingCount} said coming</span>
          ) : null}
          {undecided > 0 ? (
            <span className="chip chip-warn">{undecided} to decide</span>
          ) : null}
          {session.cancelled ? (
            <span className="chip chip-warn">Cancelled</span>
          ) : null}
        </div>
      </PageHead>

      {error ? (
        <div className="note warn" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      ) : null}

      {changeMessage ? (
        <div className="card stack" style={{ marginBottom: 14 }}>
          <div className="small" style={{ fontWeight: 700 }}>
            Let the ladies know
          </div>
          <div
            className="card"
            style={{
              background: "var(--sand)",
              whiteSpace: "pre-line",
              fontSize: 14,
            }}
          >
            {changeMessage}
          </div>
          <ShareToWhatsApp text={changeMessage}>
            <Icon name="send" size={18} /> Share to WhatsApp
          </ShareToWhatsApp>
        </div>
      ) : null}

      {session.cancelled ? (
        <div className="note warn" style={{ marginBottom: 14 }}>
          <Icon name="x" />
          <span>
            This session is cancelled
            {session.cancel_reason ? ` (${session.cancel_reason})` : ""}, so no
            one can be marked here.
          </span>
        </div>
      ) : isFuture ? (
        <div className="note" style={{ marginBottom: 14 }}>
          <Icon name="clock" />
          <span>
            This session hasn&apos;t happened yet. You can take the register on
            the day.
          </span>
        </div>
      ) : isPast ? (
        <div className="note" style={{ marginBottom: 14 }}>
          <Icon name="clock" />
          <span>
            This session has finished. Any change here corrects its register.
          </span>
        </div>
      ) : null}

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
        <>
          {sections.map((sec) =>
            sec.list.length > 0 ? (
              <section key={sec.key} className="reg-section">
                {sections.filter((x) => x.list.length > 0).length > 1 ? (
                  <h2 className="reg-heading">
                    {sec.title}
                    <span>{sec.list.length}</span>
                  </h2>
                ) : null}
                <ul className="list">{sec.list.map(row)}</ul>
              </section>
            ) : null,
          )}
          {shown.length === 0 ? (
            <div className="card empty">No one called &ldquo;{q}&rdquo;.</div>
          ) : null}
        </>
      )}

      <div className="stack" style={{ marginTop: 20 }}>
        <details className="details" hidden={locked}>
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

        {isOrganiser && !session.cancelled && !isPast && !anyoneHere ? (
          <details className="details">
            <summary>
              <Icon name="clock" /> Move or rename this session
            </summary>
            <form action={moveSession} className="stack">
              <Hidden name="sessionId" value={id} />
              <div className="form-row">
                <div className="field">
                  <label htmlFor="move-date">Date</label>
                  <input
                    id="move-date"
                    name="date"
                    type="date"
                    min={today}
                    defaultValue={session.session_date}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="move-time">Time</label>
                  <input
                    id="move-time"
                    name="time"
                    type="time"
                    defaultValue={session.start_time.slice(0, 5)}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="move-title">Name</label>
                <input
                  id="move-title"
                  name="title"
                  defaultValue={session.title}
                />
              </div>
              <p className="small muted">
                Only this one session changes. If the date or time changes, the
                ladies&apos; &ldquo;I&apos;m coming&rdquo; answers are cleared
                and you&apos;ll get a message to send to the group.
              </p>
              <SubmitButton
                className="btn btn-primary btn-block"
                pendingText="Saving…"
              >
                Save change
              </SubmitButton>
            </form>
          </details>
        ) : null}

        {!isOrganiser ? null : session.cancelled ? (
          <form action={restoreSession}>
            <Hidden name="sessionId" value={id} />
            <SubmitButton
              className="btn btn-quiet btn-block"
              pendingText="Saving…"
            >
              Bring this session back
            </SubmitButton>
          </form>
        ) : !isPast ? (
          <details className="details">
            <summary>
              <Icon name="x" /> Cancel this session
            </summary>
            <form action={cancelSession} className="stack">
              <Hidden name="sessionId" value={id} />
              <div className="field">
                <label htmlFor="cancel-reason">Reason (optional)</label>
                <input
                  id="cancel-reason"
                  name="reason"
                  maxLength={120}
                  placeholder="e.g. hall not available"
                />
              </div>
              <p className="small muted">
                The ladies will see it as cancelled, with the reason.
                You&apos;ll get a message to send to the group.
              </p>
              <ConfirmSubmit
                className="btn btn-danger btn-block"
                pendingText="Cancelling…"
                confirm={`Cancel the ${formatTime(session.start_time)} session on ${formatDay(session.session_date)}?`}
              >
                Cancel this session
              </ConfirmSubmit>
            </form>
          </details>
        ) : null}
      </div>
    </>
  );
}
