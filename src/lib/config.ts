import type { Metadata } from "next";
import { headers } from "next/headers";

/** The app's name, shown on screens, the home-screen icon and shared links. */
export const APP_NAME = "LiveFit";
export const APP_FULL_NAME = "LiveFit Club";

/** The brand name. (Each group has its own name too, set in Settings.) */
// export function groupName(): string {
//   return APP_NAME;
// }

/** The address of the live site, for building links to send on WhatsApp. */
export async function siteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The link a lady taps to ask to join one group, e.g. …/join/livefitclub-7a3f. */
export function joinLink(
  origin: string,
  group: { id: string; join_slug: string | null },
): string {
  if (group.join_slug) return `${origin}/join/${group.join_slug}`;
  // Before migration 012 is run: the older, long link.
  const params = new URLSearchParams({ g: group.id });
  const code = process.env.JOIN_CODE;
  if (code) params.set("code", code);
  return `${origin}/join?${params.toString()}`;
}

/** The picture shown when a link is shared on WhatsApp. */
export const SHARE_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: APP_FULL_NAME,
};

/** The WhatsApp preview for a join link: "Join LiveFit Club". */
export function joinMetadata(name?: string): Metadata {
  const title = `Join ${name || APP_FULL_NAME}`;
  const description =
    "Ladies only. Send your name and WhatsApp number, and the organiser will send you your own link.";
  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      siteName: APP_FULL_NAME,
      title,
      description,
      images: [SHARE_IMAGE],
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARE_IMAGE.url],
    },
  };
}
