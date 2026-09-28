import { cookies } from "next/headers";
import { MEMBER_COOKIE } from "@/lib/memberAuth";

export const dynamic = "force-dynamic";

// On iPhone the home-screen app doesn't share cookies with Safari. Starting from the
// personal link each time signs her in again, so the installed app always works.
export async function GET() {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  const manifest = {
    name: "LiveFit Club",
    short_name: "LiveFit",
    start_url: token ? `/m/${token}` : "/me",
    scope: "/",
    display: "standalone",
    background_color: "#fdf9ee",
    theme_color: "#681c4c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json", "cache-control": "no-store" },
  });
}
