"use client";

import { useState, type ReactNode } from "react";
import { whatsappUrl } from "@/lib/phone";
import { Icon } from "./Icon";

/** Copies text in a way that works on older phones too. */
function copyText(text: string) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      // Nothing more we can do; the text is still in the chat if WhatsApp kept it.
    }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(fallback);
  } else {
    fallback();
  }
}

type Props = {
  /** The message to send. */
  text: string;
  /** Her WhatsApp number, to open a chat with just her. Leave out to share to a group. */
  phone?: string | null;
  className?: string;
  /** What the button says for a moment after it's tapped. */
  copiedLabel?: string;
  children: ReactNode;
};

/**
 * Opens WhatsApp with the message ready, without emoji getting garbled.
 * - On a phone, sharing to a group uses the phone's own share sheet, which keeps
 *   the text exactly as written.
 * - Otherwise the message is copied first, then WhatsApp opens, so it can be pasted.
 */
export function ShareToWhatsApp({
  text,
  phone = null,
  className = "btn btn-primary btn-block",
  copiedLabel = "Copied. Paste it in WhatsApp",
  children,
}: Props) {
  const [copied, setCopied] = useState(false);
  const direct = phone ? whatsappUrl(phone, "") : null;
  const href = direct ?? `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        const touch = window.matchMedia("(pointer: coarse)").matches;
        if (!direct && touch && typeof navigator.share === "function") {
          e.preventDefault();
          navigator.share({ text }).catch(() => {
            // She closed the share sheet; nothing to do.
          });
          return;
        }
        copyText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 4000);
      }}
    >
      {copied ? (
        <>
          <Icon name="check" size={18} /> {copiedLabel}
        </>
      ) : (
        children
      )}
    </a>
  );
}
