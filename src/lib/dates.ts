// All dates are plain "YYYY-MM-DD" strings in UK local time, so there are no
// time zone or daylight saving surprises. Weeks run Monday to Sunday.

const LONDON = "Europe/London";

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Monday of the week containing this date. */
export function weekStart(iso: string): string {
  const back = (toDate(iso).getUTCDay() + 6) % 7;
  return addDays(iso, -back);
}

/** First day of the month containing this date. */
export function monthStart(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

export function addMonths(monthIso: string, n: number): string {
  const d = toDate(monthIso);
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return toISO(d);
}

export function lastDayOfMonth(monthIso: string): string {
  return addDays(addMonths(monthStart(monthIso), 1), -1);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(toDate(iso));
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toDate(iso));
}

export function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(toDate(iso));
}

export function monthName(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(toDate(iso));
}

/** A date split up for a small calendar block: { dow: "Tue", day: "29", mon: "Sept" }. */
export function dayParts(iso: string): { dow: string; day: string; mon: string } {
  const d = toDate(iso);
  const part = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(d);
  return {
    dow: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    mon: part({ month: "short" }),
  };
}

/** The usual session name. Only a different name is worth showing. */
export const DEFAULT_SESSION_TITLE = "Workout session";
export function extraTitle(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  return t && t.toLowerCase() !== DEFAULT_SESSION_TITLE.toLowerCase() ? t : "";
}

/** "19:00:00" becomes "7:00 pm". */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
