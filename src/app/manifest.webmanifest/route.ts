// The install details for the organiser's app. The ladies get their own version at /me/manifest.webmanifest.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    name: "LiveFit Club",
    short_name: "LiveFit",
    description: "Sessions, plans and payments for LiveFit Club.",
    start_url: "/",
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
    headers: { "content-type": "application/manifest+json" },
  });
}
