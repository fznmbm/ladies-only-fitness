import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDay,
  formatTime,
  lastDayOfMonth,
  monthStart,
  todayISO,
  weekStart,
} from "@/lib/dates";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

function MessageCard({ title, lines }: { title: string; lines: string[] }) {
  const text = lines.join("\n");
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <div className="card stack">
      <h2 className="section-title" style={{ margin: 0 }}>
        {title}
      </h2>
      <div
        className="card"
        style={{
          background: "var(--sand)",
          whiteSpace: "pre-line",
          fontSize: 14,
        }}
      >
        {text}
      </div>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-block"
      >
        <Icon name="send" size={18} /> Share to WhatsApp
      </a>
    </div>
  );
}

export default async function SharePage() {
  const supabase = await createClient();
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const ws = weekStart(today);
  const monthEnd = lastDayOfMonth(today);

  const [{ data: weekData }, { data: tomorrowData }, { count: endingSoon }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("*")
        .gte("session_date", ws)
        .lte("session_date", addDays(ws, 6))
        .eq("cancelled", false)
        .order("session_date")
        .order("start_time"),
      supabase
        .from("sessions")
        .select("*")
        .eq("session_date", tomorrow)
        .eq("cancelled", false)
        .order("start_time"),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("month", monthStart(today))
        .eq("status", "confirmed"),
    ]);

  const weekSessions = (weekData ?? []) as Session[];
  const tomorrowSessions = (tomorrowData ?? []) as Session[];

  const weekLines = [
    "Sessions this week 💪",
    ...weekSessions.map(
      (s) =>
        `${formatDay(s.session_date).split(" ")[0]} ${formatTime(s.start_time)}`,
    ),
    "",
    "Open your app to let us know if you're coming, or just turn up!",
  ];

  const tomorrowLines =
    tomorrowSessions.length > 0
      ? [
          `Reminder: session tomorrow`,
          ...tomorrowSessions.map((s) => formatTime(s.start_time)),
          "",
          "See you there!",
        ]
      : [];

  const endingLines = [
    `Plans end on ${formatDay(monthEnd)}.`,
    "Renew for next month any time in your app, by bank transfer or cash. Thank you!",
  ];

  return (
    <>
      <PageHead
        title="Share to group"
        sub="Pick a message. It opens WhatsApp with the text ready, and you choose who to send it to."
      />

      <div className="stack">
        <MessageCard title="This week's sessions" lines={weekLines} />

        {tomorrowSessions.length > 0 ? (
          <MessageCard title="Reminder for tomorrow" lines={tomorrowLines} />
        ) : (
          <div className="note">
            <Icon name="clock" />
            <span>
              No session tomorrow, so there&apos;s no reminder to send.
            </span>
          </div>
        )}

        <MessageCard title="Plans ending soon" lines={endingLines} />
        {typeof endingSoon === "number" ? (
          <p className="small muted" style={{ marginTop: -8 }}>
            {endingSoon} {endingSoon === 1 ? "plan is" : "plans are"} confirmed
            for this month.
          </p>
        ) : null}
      </div>
    </>
  );
}
