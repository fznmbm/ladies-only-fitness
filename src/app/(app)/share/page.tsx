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
import { ShareToWhatsApp } from "@/components/ShareToWhatsApp";
import { requireGroup } from "@/lib/groups";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

function MessageCard({ title, lines }: { title: string; lines: string[] }) {
  const text = lines.join("\n");
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
      <ShareToWhatsApp text={text}>
        <Icon name="send" size={18} /> Share to WhatsApp
      </ShareToWhatsApp>
    </div>
  );
}

export default async function SharePage() {
  const supabase = await createClient();
  const group = await requireGroup();
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const ws = weekStart(today);
  const monthEnd = lastDayOfMonth(today);

  const [{ data: weekData }, { data: tomorrowData }, { count: endingSoon }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("*")
        .eq("group_id", group.id)
        .gte("session_date", ws)
        .lte("session_date", addDays(ws, 13))
        .eq("cancelled", false)
        .order("session_date")
        .order("start_time"),
      supabase
        .from("sessions")
        .select("*")
        .eq("group_id", group.id)
        .eq("session_date", tomorrow)
        .eq("cancelled", false)
        .order("start_time"),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("group_id", group.id)
        .eq("month", monthStart(today))
        .eq("status", "confirmed"),
    ]);

  const nextWs = addDays(ws, 7);
  const twoWeeks = (weekData ?? []) as Session[];
  const weekSessions = twoWeeks.filter((s) => s.session_date < nextWs);
  const nextWeekSessions = twoWeeks.filter((s) => s.session_date >= nextWs);
  const tomorrowSessions = (tomorrowData ?? []) as Session[];

  const nextWeekLines = [
    `${group.name}: sessions next week (from ${formatDay(nextWs).replace(/^\w+ /, "")})`,
    ...nextWeekSessions.map(
      (s) =>
        `${formatDay(s.session_date).split(" ")[0]} ${formatTime(s.start_time)}`,
    ),
    "",
    "Open your app to let us know if you're coming, or just turn up!",
  ];

  const weekLines = [
    `${group.name}: sessions this week`,
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
          `${group.name}: reminder, session tomorrow`,
          ...tomorrowSessions.map((s) => formatTime(s.start_time)),
          "",
          "See you there!",
        ]
      : [];

  const endingLines = [
    `${group.name}: plans end on ${formatDay(monthEnd)}.`,
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

        {nextWeekSessions.length > 0 ? (
          <MessageCard title="Next week's sessions" lines={nextWeekLines} />
        ) : null}

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
