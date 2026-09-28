/** @type {import('next').NextConfig} */
const nextConfig = {
  // Always put the page details (install manifest, app icon, title) in the page
  // <head>, where phones look for them. Otherwise Next.js sends them later, in the
  // body, on pages with a loading screen, and phones then can't install the app.
  htmlLimitedBots: /.*/,

  // Standard browser protections on every page.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Other websites can't show this app inside a frame (stops click-jacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Browsers must trust the file types the app sends.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Links to other sites only reveal the app's address, never a full page path.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app never needs these, so no page can ask for them.
          {
            key: "Permissions-Policy",
            value: "microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        // Phones always check for a newer offline helper.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },

  experimental: {
    serverActions: {
      // A phone photo of a receipt is usually 1-4 MB.
      bodySizeLimit: "8mb",
    },
  },
};
export default nextConfig;
