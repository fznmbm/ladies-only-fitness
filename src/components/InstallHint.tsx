"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

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

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
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
          await event.userChoice;
          setEvent(null);
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
          ? "To keep this on your phone: tap the Share button in Safari, then Add to Home Screen."
          : "To keep this on your phone: open the browser menu, then choose Install app or Add to Home screen."}
      </span>
    </div>
  );
}
