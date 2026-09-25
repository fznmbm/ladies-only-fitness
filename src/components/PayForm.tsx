"use client";

import { useActionState, useState } from "react";
import { payForMonth } from "@/app/me/actions";
import { pounds } from "@/lib/money";
import { Icon } from "./Icon";
import type { Plan } from "@/lib/types";

type Bank = { name: string; sortCode: string; accountNumber: string };

type Props = {
  plans: Plan[];
  bank: Bank;
  months: { value: string; label: string }[];
  defaultMonth: string;
  memberFirstName: string;
};

export function PayForm({
  plans,
  bank,
  months,
  defaultMonth,
  memberFirstName,
}: Props) {
  const [state, action, pending] = useActionState(payForMonth, null);
  const [fileName, setFileName] = useState<string | null>(null);

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
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="planId">Plan</label>
        <select id="planId" name="planId" required defaultValue="">
          <option value="" disabled>
            Choose a plan
          </option>
          {plans.map((p) => (
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
          Reference: {memberFirstName}
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

      <button
        type="submit"
        className="btn btn-primary btn-block"
        style={{ minHeight: 52 }}
        disabled={pending}
      >
        <Icon name="upload" size={18} />
        {pending ? "Sending…" : "I've paid: send receipt"}
      </button>
    </form>
  );
}
