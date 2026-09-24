"use client";

import { useActionState, useState } from "react";
import { approveRequest, declineRequest, makeLoginLink } from "@/app/actions";
import type { LinkState } from "@/app/actions";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline btn-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          window.prompt("Copy this link", text);
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function SendBox({ state }: { state: LinkState }) {
  if (!state) return null;
  if ("error" in state) {
    return (
      <div className="note warn" role="alert">
        {state.error}
      </div>
    );
  }
  return (
    <div className="sendbox">
      <p className="small">Her personal link is ready. Send it on WhatsApp.</p>
      <div className="cluster">
        {state.wa ? (
          <a href={state.wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-small">
            <Icon name="send" size={18} /> Open WhatsApp
          </a>
        ) : (
          <span className="small muted">Add her WhatsApp number to send it directly.</span>
        )}
        <CopyButton text={state.url} />
      </div>
    </div>
  );
}

/** On a member's page: make a new personal link and send it. */
export function LoginLinkButton({ memberId, label }: { memberId: string; label: string }) {
  const [state, action, pending] = useActionState(makeLoginLink, null);
  return (
    <div className="stack">
      <form action={action}>
        <input type="hidden" name="memberId" value={memberId} />
        <button type="submit" className="btn btn-outline btn-block" disabled={pending}>
          <Icon name="send" size={18} /> {pending ? "Making link…" : label}
        </button>
      </form>
      <SendBox state={state} />
    </div>
  );
}

/** A lady asking to join: approve (and send her link) or decline. */
export function RequestRow({ id, name, phone }: { id: string; name: string; phone: string | null }) {
  const [state, action, pending] = useActionState(approveRequest, null);
  const approved = !!state && "url" in state;
  return (
    <li>
      <div className="row-main">
        <Avatar name={name} />
        <div className="grow">
          <div className="name">{name}</div>
          <div className="sub">{phone ?? "No number"}</div>
        </div>
        {approved ? (
          <span className="chip">
            <Icon name="check" size={16} /> Approved
          </span>
        ) : (
          <div className="cluster" style={{ flexWrap: "nowrap" }}>
            <form action={action}>
              <input type="hidden" name="memberId" value={id} />
              <button type="submit" className="btn btn-primary btn-small" disabled={pending}>
                Approve
              </button>
            </form>
            <form action={declineRequest}>
              <input type="hidden" name="memberId" value={id} />
              <button type="submit" className="btn btn-quiet btn-small" aria-label={`Decline ${name}`}>
                <Icon name="x" size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
      {state ? (
        <div style={{ padding: "0 14px 14px" }}>
          <SendBox state={state} />
        </div>
      ) : null}
    </li>
  );
}
