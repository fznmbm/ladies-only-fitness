import type { Db } from "@/lib/supabase/server";
import type { Attendance, Subscription } from "@/lib/types";
import { addDays, monthStart, weekStart } from "@/lib/dates";
import { pounds } from "@/lib/money";

/**
 * Works out whether a lady is covered for a session:
 * her plan for that calendar month, and how many other sessions she has
 * already attended in the same Monday to Sunday week.
 */
export async function memberContext(
  supabase: Db,
  memberId: string,
  sessionId: string,
  sessionDate: string,
) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("member_id", memberId)
    .eq("month", monthStart(sessionDate))
    .in("status", ["pending", "confirmed"])
    .maybeSingle();

  const ws = weekStart(sessionDate);
  const { data: weekSessions } = await supabase
    .from("sessions")
    .select("id")
    .gte("session_date", ws)
    .lte("session_date", addDays(ws, 6));

  const ids = ((weekSessions ?? []) as { id: string }[])
    .map((s) => s.id)
    .filter((id) => id !== sessionId);

  let usedOthers = 0;
  if (ids.length > 0) {
    const { count } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .in("session_id", ids);
    usedOthers = count ?? 0;
  }
  return { sub: (sub ?? null) as Subscription | null, usedOthers };
}

export type Tone = "ok" | "warn" | "bad";

/** The short status line shown under a lady's name on the register. */
export function planLine(
  sub: Subscription | null,
  used: number,
  here: Attendance | null,
): { text: string; tone: Tone } {
  if (!sub) {
    if (here?.resolution === "pay_later") return { text: "Pays later", tone: "warn" };
    return { text: "No plan this month", tone: "bad" };
  }
  const allowance = sub.sessions_per_week;
  let text = `${allowance} a week, ${used} of ${allowance} used`;
  let tone: Tone = "ok";
  if (sub.status === "pending") {
    text += ", payment pending";
    tone = "warn";
  }
  if (here?.flag === "over_plan") {
    if (here.resolution === "allowed") {
      text = `${used} of ${allowance} used, allowed this time`;
      tone = "warn";
    } else if (here.resolution === "cash") {
      text = `${used} of ${allowance} used, paid ${pounds(here.extra_paid_pence)} cash`;
      tone = "warn";
    } else if (here.resolution === "pay_later") {
      text = `${used} of ${allowance} used, pays later`;
      tone = "warn";
    } else {
      tone = "bad";
    }
  }
  return { text, tone };
}
