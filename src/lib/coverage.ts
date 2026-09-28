import type { Attendance, Subscription } from "@/lib/types";
import { pounds } from "@/lib/money";

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
