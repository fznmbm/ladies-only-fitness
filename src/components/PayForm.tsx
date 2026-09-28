"use client";

import { useActionState, useState } from "react";
import { payForMonth } from "@/app/me/actions";
import { shrinkImage } from "@/lib/shrinkImage";
import { pounds } from "@/lib/money";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";
import type { Plan } from "@/lib/types";

type Bank = { name: string; sortCode: string; accountNumber: string };

type Props = {
  plans: Plan[];
  /** Her groups. With more than one, she first picks which group she's paying for. */
  groups: { id: string; name: string }[];
  bank: Bank;
  months: { value: string; label: string }[];
  defaultMonth: string;
  /** Her own reference to put on the bank transfer, e.g. AMINA-4821. */
  payRef: string;
};

export function PayForm({
  plans,
  groups,
  bank,
  months,
  defaultMonth,
  payRef,
}: Props) {
  const [state, action, pending] = useActionState(payForMonth, null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const groupPlans = plans.filter((p) => p.group_id === groupId);

  if (state && "ok" in state) {
    return (
      <div className="note">
        <Icon name="check" />
        <span>
          Sent! The organiser will confirm it soon. You can still come in the
          meantime.
        </span>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        // Shrink the photo on her phone first, so it uploads fast and fits.
        const receipt = formData.get("receipt");
        if (receipt instanceof File && receipt.size > 0) {
          formData.set("receipt", await shrinkImage(receipt));
        }
        action(formData);
      }}
      className="stack"
    >
      {groups.length > 1 ? (
        <div className="field">
          <label htmlFor="payGroup">Group</label>
          <select
            id="payGroup"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="planId">Plan</label>
        {/* A new list for each group, so a plan from another group can't stay picked. */}
        <select key={groupId} id="planId" name="planId" required defaultValue="">
          <option value="" disabled>
            {groupPlans.length > 0 ? "Choose a plan" : "No plans for this group yet"}
          </option>
          {groupPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {pounds(p.price_pence)} a month
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="month">Covers</label>
        <select id="month" name="month" defaultValue={defaultMonth}>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card stack" style={{ background: "var(--sand)" }}>
        <div className="small" style={{ fontWeight: 700 }}>
          Transfer to
        </div>
        <div className="small">
          {bank.name}
          <br />
          Sort code {bank.sortCode} · Account {bank.accountNumber}
          <br />
          Reference: <strong>{payRef}</strong>
        </div>
      </div>

      <div className="field">
        <label htmlFor="receipt">Photo of your receipt</label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        {fileName ? <span className="small muted">{fileName}</span> : null}
      </div>

      {state && "error" in state ? (
        <div className="note warn" role="alert">
          {state.error}
        </div>
      ) : null}

      <SubmitButton
        className="btn btn-primary btn-block"
        style={{ minHeight: 52 }}
        disabled={pending}
        pendingText="Sending…"
      >
        <Icon name="upload" size={18} />
        I&apos;ve paid: send receipt
      </SubmitButton>
    </form>
  );
}
