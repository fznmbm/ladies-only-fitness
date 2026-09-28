import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDate,
  formatDay,
  formatTime,
  todayISO,
  weekStart,
} from "@/lib/dates";
import { addSession, generateSessions } from "@/app/actions";
import { PageHead } from "@/components/PageHead";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { requireGroup } from "@/lib/groups";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

/** "This week", "Next week", "Last week", or the dates, e.g. "6 – 12 Oct". */
function weekLabel(monday: string, thisMonday: string): string {
  if (monday === thisMonday) return "This week";
  if (monday === addDays(thisMonday, 7)) return "Next week";
  if (monday === addDays(thisMonday, -7)) return "Last week";
  const from = formatDate(monday).replace(/^\w+ /, "");
  const to = formatDate(addDays(monday, 6)).replace(/^\w+ /, "");
  return `${from} – ${to}`;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createClient();
  const group = await requireGroup();
  const today = todayISO();
  const thisMonday = weekStart(today);
  // The week being looked at: this week unless ‹ › was tapped.
  const monday =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? weekStart(week) : thisMonday;
  const sunday = addDays(monday, 6);

  // This week's sessions and the next session from today, all at once.
  const [{ data }, { data: nextData }, { count: slotCount }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("*")
        .eq("group_id", group.id)
        .gte("session_date", monday)
        .lte("session_date", sunday)
        .order("session_date")
        .order("start_time"),
      supabase
        .from("sessions")
        .select("*")
        .eq("group_id", group.id)
        .eq("cancelled", false)
        .gte("session_date", today)
        .order("session_date")
        .order("start_time")
        .limit(3),
      supabase
        .from("schedule_slots")
        .select("id", { count: "exact", head: true })
        .eq("group_id", group.id),
    ]);

  const sessions = (data ?? []) as Session[];
  const upcoming = (nextData ?? []) as Session[];
  const todays = upcoming.filter((s) => s.session_date === today);
  const nextOne = upcoming.find((s) => s.session_date > today) ?? null;

  // Who came, and who said "I'm coming", for everything on screen.
  const ids = [...new Set([...sessions, ...todays].map((s) => s.id))];
  const counts = new Map<string, number>();
  const coming = new Map<string, number>();
  if (ids.length > 0) {
    const [{ data: att }, { data: rsvps }] = await Promise.all([
      supabase.from("attendance").select("session_id").in("session_id", ids),
      supabase
        .from("rsvps")
        .select("session_id")
        .eq("coming", true)
        .in("session_id", ids),
    ]);
    for (const a of (att ?? []) as { session_id: string }[]) {
      counts.set(a.session_id, (counts.get(a.session_id) ?? 0) + 1);
    }
    for (const r of (rsvps ?? []) as { session_id: string }[]) {
      coming.set(r.session_id, (coming.get(r.session_id) ?? 0) + 1);
    }
  }

  const byDate = new Map<string, Session[]>();
  for (const s of sessions)
    byDate.set(s.session_date, [...(byDate.get(s.session_date) ?? []), s]);

  const live = sessions.filter((s) => !s.cancelled);
  const visits = live.reduce((n, s) => n + (counts.get(s.id) ?? 0), 0);
  const isCurrentWeek = monday === thisMonday;

  return (
    <>
      <PageHead title="Sessions" />

      {/* Today first: what the organiser opens the app for most of the time. */}
      {!isCurrentWeek ? null : todays.length > 0 ? (
        <div className="stack" style={{ marginBottom: 20 }}>
          {todays.map((s) => (
            <div key={s.id} className="today-card">
              <div className="today-label">Today</div>
              <div className="today-time">
                {formatTime(s.start_time)}
                <span>{s.title}</span>
              </div>
              <div className="cluster" style={{ gap: 8, marginTop: 10 }}>
                <span className="chip chip-light">
                  {counts.get(s.id) ?? 0} here
                </span>
                {(coming.get(s.id) ?? 0) > 0 ? (
                  <span className="chip chip-light">
                    {coming.get(s.id)} said coming
                  </span>
                ) : null}
              </div>
              <Link
                href={`/sessions/${s.id}`}
                className="btn btn-light btn-block"
                style={{ marginTop: 14 }}
              >
                <Icon name="clip" size={18} /> Take the register
              </Link>
            </div>
          ))}
        </div>
      ) : nextOne ? (
        <Link
          href={`/sessions/${nextOne.id}`}
          className="note"
          style={{ marginBottom: 20, textDecoration: "none" }}
        >
          <Icon name="clock" />
          <span>
            No session today. Next: <strong>{nextOne.title}</strong>,{" "}
            {formatDay(nextOne.session_date)} at{" "}
            {formatTime(nextOne.start_time)}
            {(coming.get(nextOne.id) ?? 0) > 0
              ? `, ${coming.get(nextOne.id)} said coming`
              : ""}
            .
          </span>
        </Link>
      ) : null}

      {/* Week by week, back into the past and forward into the future. */}
      <nav className="week-nav" aria-label="Choose a week">
        <Link
          href={`/sessions?week=${addDays(monday, -7)}`}
          className="btn btn-quiet btn-small"
          aria-label="Previous week"
        >
          <Icon name="back" size={18} />
        </Link>
        <div className="week-title">
          <strong>{weekLabel(monday, thisMonday)}</strong>
          <span>
            {live.length} {live.length === 1 ? "session" : "sessions"}
            {monday <= thisMonday
              ? `, ${visits} ${visits === 1 ? "visit" : "visits"}`
              : ""}
          </span>
        </div>
        <Link
          href={`/sessions?week=${addDays(monday, 7)}`}
          className="btn btn-quiet btn-small"
          aria-label="Next week"
        >
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="back" size={18} />
          </span>
        </Link>
      </nav>
      {!isCurrentWeek ? (
        <p style={{ textAlign: "center", margin: "-6px 0 10px" }}>
          <Link href="/sessions" className="small">
            Back to this week
          </Link>
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <div className="card empty stack" style={{ alignItems: "center" }}>
          <p>No sessions this week.</p>
          {(slotCount ?? 0) === 0 ? (
            <Link href="/settings" className="btn btn-primary">
              Set up the weekly timetable
            </Link>
          ) : monday >= thisMonday ? (
            <p className="small muted">
              Sessions are made 3 weeks ahead from the weekly timetable.
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          {[...byDate.entries()].map(([date, list]) => {
            const isToday = date === today;
            return (
              <section key={date}>
                <h2 className={isToday ? "day-heading today" : "day-heading"}>
                  {isToday ? "Today, " : ""}
                  {formatDay(date)}
                </h2>
                <div className="stack" style={{ gap: 8 }}>
                  {list.map((s) => {
                    const came = counts.get(s.id) ?? 0;
                    const said = coming.get(s.id) ?? 0;
                    // Moved by hand from its usual day or time.
                    const moved =
                      !!s.slot_date && s.slot_date !== s.session_date;
                    const classes = [
                      "session-card",
                      isToday ? "today" : "",
                      s.cancelled ? "cancelled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <Link
                        key={s.id}
                        href={`/sessions/${s.id}`}
                        className={classes}
                      >
                        <span className="time">{formatTime(s.start_time)}</span>
                        <span className="grow">
                          <span className="name">{s.title}</span>
                          {s.cancelled && s.cancel_reason ? (
                            <span className="sub" style={{ display: "block" }}>
                              {s.cancel_reason}
                            </span>
                          ) : moved ? (
                            <span className="sub" style={{ display: "block" }}>
                              Moved from {formatDate(s.slot_date!)}
                            </span>
                          ) : null}
                        </span>
                        {s.cancelled ? (
                          <span className="chip chip-warn">Cancelled</span>
                        ) : date < today ? (
                          <span className="chip">{came} here</span>
                        ) : date === today ? (
                          <span className="chip">
                            {came} here{said > 0 ? `, ${said} coming` : ""}
                          </span>
                        ) : said > 0 ? (
                          <span className="chip">{said} coming</span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="stack" style={{ marginTop: 28 }}>
        {(slotCount ?? 0) > 0 ? (
          <form action={generateSessions}>
            <SubmitButton
              className="btn btn-outline btn-block"
              pendingText="Checking…"
            >
              <Icon name="plus" /> Make any missing sessions from the timetable
            </SubmitButton>
          </form>
        ) : null}
        <details className="details">
          <summary>
            <Icon name="plus" /> Add a one-off session
          </summary>
          <form action={addSession}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="date">Date</label>
                <input id="date" name="date" type="date" min={today} required />
              </div>
              <div className="field">
                <label htmlFor="time">Time</label>
                <input id="time" name="time" type="time" required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="title">Name (optional)</label>
              <input id="title" name="title" placeholder="Workout session" />
            </div>
            <SubmitButton
              className="btn btn-primary btn-block"
              pendingText="Adding…"
            >
              Add session
            </SubmitButton>
          </form>
        </details>
      </div>
    </>
  );
}
