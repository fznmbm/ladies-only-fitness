"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

// Set by the small script in the root layout, which catches the offer early.
type WithInstall = Window & { __installEvent?: InstallEvent | null };

export function InstallHint() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

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

  return (
    <div className="note">
      <Icon name="plus" />
      <span>
        {ios
          ? "To keep this on your phone: open this page in Safari (if you came from WhatsApp, tap the Safari compass first), then tap Share, then Add to Home Screen."
          : "To keep this on your phone: open this page in Chrome (if you came from WhatsApp, tap ⋮ then Open in Chrome first), then tap ⋮ and choose Add to Home screen or Install app."}
      </span>
    </div>
  );
}
