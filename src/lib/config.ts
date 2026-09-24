import { headers } from "next/headers";

export function groupName(): string {
  return process.env.NEXT_PUBLIC_GROUP_NAME || "Ladies Fitness";
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

export function joinLink(origin: string): string {
  const code = process.env.JOIN_CODE;
  return code ? `${origin}/join?code=${encodeURIComponent(code)}` : `${origin}/join`;
}
