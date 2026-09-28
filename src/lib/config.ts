import { headers } from "next/headers";

/** The app's name, shown on screens, the home-screen icon and shared links. */
export const APP_NAME = "LiveFit";
export const APP_FULL_NAME = "LiveFit Club";

/** The brand name. (Each group has its own name too, set in Settings.) */
export function groupName(): string {
  return APP_NAME;
}

/** The address of the live site, for building links to send on WhatsApp. */
export async function siteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The link a lady taps to ask to join one group. */
export function joinLink(origin: string, groupId: string): string {
  const params = new URLSearchParams({ g: groupId });
  const code = process.env.JOIN_CODE;
  if (code) params.set("code", code);
  return `${origin}/join?${params.toString()}`;
}
