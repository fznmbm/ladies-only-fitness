import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

// Fonts are downloaded once at build time and served from this site, so the
// first screen no longer waits on Google.
const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-sans",
});
const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-display",
});

const description =
  "Sessions, plans and payments for LiveFit Club, a ladies-only fitness group.";

export const metadata: Metadata = {
  // Makes the link-preview image a full web address (needed by WhatsApp).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://ladies-only-fitness.vercel.app"),
  ),
  title: { default: "LiveFit", template: "%s · LiveFit" },
  applicationName: "LiveFit",
  description,
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "LiveFit", statusBarStyle: "default" },
  // What a link shows when it's shared on WhatsApp and elsewhere.
  openGraph: {
    type: "website",
    siteName: "LiveFit Club",
    title: "LiveFit Club",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LiveFit Club" }],
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "LiveFit Club",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#681c4c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* Starts the offline helper (shows a "no signal" page instead of an error), and
            catches the "install this app" offer as soon as Chrome makes it, before the
            page has finished loading. The Add to home screen button picks it up from here. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installEvent=e;window.dispatchEvent(new Event("installready"))});window.addEventListener("appinstalled",function(){window.__installEvent=null;window.dispatchEvent(new Event("installready"))});`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
