// The install details for the organiser's app. The ladies get their own version at /me/manifest.webmanifest.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    name: process.env.NEXT_PUBLIC_GROUP_NAME || "Ladies Fitness",
    short_name: "Fitness",
    description: "Sessions, plans and attendance for the ladies fitness group.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf5ef",
    theme_color: "#5b2a4e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json" },
  });
}
