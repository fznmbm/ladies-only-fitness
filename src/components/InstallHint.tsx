"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

// Set by the small script in the root layout, which catches the offer early.
type WithInstall = Window & { __installEvent?: InstallEvent | null };

/** "Not now" hides the card on this phone for two weeks. */
const LATER_KEY = "install-later";
const LATER_MS = 14 * 24 * 60 * 60 * 1000;

export function InstallHint() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(true); // until checked, show nothing
  const [ios, setIos] = useState(false);
  const [chromeIos, setChromeIos] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    setIos(isIos);
    setChromeIos(/CriOS/i.test(ua));
    // Apps like WhatsApp open links in their own browser, which can't add to
    // the home screen. Real Safari and Chrome say "Safari" in their name.
    setInApp(isIos && !/Safari/i.test(ua));
    try {
      const later = Number(localStorage.getItem(LATER_KEY) || 0);
      if (later && Date.now() - later < LATER_MS) setHidden(true);
    } catch {
      // Storage unavailable: always show.
    }

    const w = window as WithInstall;
    const sync = () => setEvent(w.__installEvent ?? null);
    sync(); // The offer may already have arrived before this button appeared.
    window.addEventListener("installready", sync);
    return () => window.removeEventListener("installready", sync);
  }, []);

  if (installed) return null;

  if (event) {
    return (
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ minHeight: 52 }}
        onClick={async () => {
          await event.prompt();
          const { outcome } = await event.userChoice;
          // Chrome only offers once per page load, so clear it either way.
          (window as WithInstall).__installEvent = null;
          setEvent(null);
          if (outcome === "accepted") setInstalled(true);
        }}
      >
        <Icon name="plus" /> Add to your home screen
      </button>
    );
  }

  if (hidden) return null;

  // iPhone: Apple doesn't allow an install button, so show exactly where to tap.
  // Chrome on iPhone has Share at the top; Safari has it at the bottom.
  const steps: React.ReactNode[] = ios
    ? [
        ...(inApp
          ? [<>Open this page in <strong>Safari</strong> first (tap the compass or &hellip; in the corner).</>]
          : []),
        <>
          Tap <strong>Share</strong> <ShareIcon />{" "}
          {chromeIos ? "at the top, next to the address." : "at the bottom of the screen."}
        </>,
        <>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </>,
        <>
          Tap <strong>Add</strong>. LiveFit appears with your other apps.
        </>,
      ]
    : [
        <>
          Open this page in <strong>Chrome</strong> (from WhatsApp, tap &#8942; then
          Open in Chrome).
        </>,
        <>
          Tap <strong>&#8942;</strong> at the top right.
        </>,
        <>
          Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.
        </>,
      ];

  return (
    <section className="install-card" aria-label="Put LiveFit on your home screen">
      <div className="install-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={40} height={40} />
        <strong>Put LiveFit on your home screen</strong>
      </div>
      <ol>
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <button
        type="button"
        className="install-later"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(LATER_KEY, String(Date.now()));
          } catch {
            // Private browsing: it just shows again next time.
          }
        }}
      >
        Not now
      </button>
    </section>
  );
}

/** The iPhone Share symbol: a box with an arrow pointing up. */
function ShareIcon() {
  return (
    <svg
      width="16"
      height="18"
      viewBox="0 0 16 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="(the square with an arrow)"
      role="img"
      style={{ verticalAlign: "-3px" }}
    >
      <path d="M8 11V1.5M4.5 4.5 8 1l3.5 3.5" />
      <path d="M5 7H2.5v9.5h11V7H11" />
    </svg>
  );
}
