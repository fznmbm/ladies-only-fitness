import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
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

export default async function SessionsPage() {
  const supabase = await createClient();
  const group = await requireGroup();
  const today = todayISO();

  const [{ data }, { count: slotCount }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("group_id", group.id)
      .gte("session_date", weekStart(today))
      .lte("session_date", addDays(today, 27))
      .order("session_date")
      .order("start_time"),
    supabase
      .from("schedule_slots")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id),
  ]);

  const sessions = (data ?? []) as Session[];
  const counts = new Map<string, number>();
  const coming = new Map<string, number>();
  if (sessions.length > 0) {
    const ids = sessions.map((s) => s.id);
    // Who came, and who said "I'm coming", at the same time.
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

  return (
    <>
      <PageHead title="Sessions" sub="Open a session to take the register." />

      {sessions.length === 0 ? (
        <div className="card empty stack" style={{ alignItems: "center" }}>
          <p>No sessions yet.</p>
          {(slotCount ?? 0) > 0 ? (
            <form action={generateSessions}>
              <SubmitButton className="btn btn-primary" pendingText="Creating…">
                <Icon name="plus" /> Create the next 3 weeks
              </SubmitButton>
            </form>
          ) : (
            <Link href="/settings" className="btn btn-primary">
              Set up the weekly timetable
            </Link>
          )}
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
        {sessions.length > 0 && (slotCount ?? 0) > 0 ? (
          <form action={generateSessions}>
            <SubmitButton
              className="btn btn-outline btn-block"
              pendingText="Adding…"
            >
              <Icon name="plus" /> Add sessions from the weekly timetable
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
                <input id="date" name="date" type="date" required />
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
