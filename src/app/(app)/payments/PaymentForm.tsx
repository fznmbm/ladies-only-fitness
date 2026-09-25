"use client";

import { useState } from "react";
import { recordPayment } from "@/app/actions";
import { pounds } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";
import type { Plan } from "@/lib/types";

type Props = {
  members: { id: string; name: string }[];
  plans: Plan[];
  months: { value: string; label: string }[];
  defaultMonth: string;
};

export function PaymentForm({ members, plans, months, defaultMonth }: Props) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [amount, setAmount] = useState(
    plans[0] ? String(plans[0].price_pence / 100) : "",
  );

  function choosePlan(id: string) {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    if (p) setAmount(String(p.price_pence / 100));
  }

  return (
    <form action={recordPayment} className="stack">
      <div className="field">
        <label htmlFor="memberId">Who paid</label>
        <select id="memberId" name="memberId" required defaultValue="">
          <option value="" disabled>
            Choose a lady
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="planId">Plan</label>
        <select
          id="planId"
          name="planId"
          value={planId}
          onChange={(e) => choosePlan(e.target.value)}
          required
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {pounds(p.price_pence)} a month
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
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
        <div className="field">
          <label htmlFor="method">Paid by</label>
          <select id="method" name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="transfer">Bank transfer</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="amount">Amount received (£)</label>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <SubmitButton
        className="btn btn-primary btn-block"
        style={{ minHeight: 52 }}
        pendingText="Recording…"
      >
        Record payment
      </SubmitButton>
    </form>
  );
}
