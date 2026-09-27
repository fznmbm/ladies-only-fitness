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

export const metadata: Metadata = {
  title: "Ladies Fitness",
  description: "Sessions, plans and attendance for the ladies fitness group.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Fitness", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5b2a4e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* Catch the "install this app" offer as soon as Chrome makes it, before the page has
            finished loading. The Add to home screen button picks it up from here. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installEvent=e;window.dispatchEvent(new Event("installready"))});window.addEventListener("appinstalled",function(){window.__installEvent=null;window.dispatchEvent(new Event("installready"))});`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
