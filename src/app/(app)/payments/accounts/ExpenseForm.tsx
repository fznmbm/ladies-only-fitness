"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addExpense } from "@/app/actions";
import { shrinkImage } from "@/lib/shrinkImage";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { EXPENSE_CATEGORIES } from "@/lib/types";

type Props = {
  groupName: string;
  /** More than one group: ask whether the cost is shared. */
  manyGroups: boolean;
  months: { value: string; label: string }[];
  defaultMonth: string;
  today: string;
};

/** Records a cost. A bulk payment can be spread over the months it covers. */
export function ExpenseForm({ groupName, manyGroups, months, defaultMonth, today }: Props) {
  const [state, action] = useActionState(addExpense, null);
  const [fileName, setFileName] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // Clear the form after a cost is saved, ready for the next one.
  useEffect(() => {
    if (state && "ok" in state) {
      form.current?.reset();
      setFileName(null);
    }
  }, [state]);

  return (
    <form
      ref={form}
      action={async (formData) => {
        const receipt = formData.get("receipt");
        if (receipt instanceof File && receipt.size > 0) {
          formData.set("receipt", await shrinkImage(receipt));
        }
        action(formData);
      }}
      className="stack"
    >
      <div className="form-row">
        <div className="field">
          <label htmlFor="exp-category">What for</label>
          <select id="exp-category" name="category" defaultValue="hall">
            {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="exp-amount">Amount (£)</label>
          <input id="exp-amount" name="amount" inputMode="decimal" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="exp-description">Note (optional)</label>
        <input
          id="exp-description"
          name="description"
          maxLength={120}
          placeholder="e.g. Community centre, Oct to Dec"
        />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="exp-paid">Date paid</label>
          <input id="exp-paid" name="paidOn" type="date" defaultValue={today} required />
        </div>
        {manyGroups ? (
          <div className="field">
            <label htmlFor="exp-scope">Which group</label>
            <select id="exp-scope" name="scope" defaultValue="group">
              <option value="group">{groupName}</option>
              <option value="all">Shared by all groups</option>
            </select>
          </div>
        ) : null}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="exp-from">Covers from</label>
          <select id="exp-from" name="coversFrom" defaultValue={defaultMonth}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="exp-months">Months it covers</label>
          <input
            id="exp-months"
            name="months"
            type="number"
            min={1}
            max={24}
            defaultValue={1}
            required
          />
        </div>
      </div>
      <p className="small muted">
        Paid for several months at once? Enter the full amount and how many
        months it covers. It&apos;s shared equally across those months.
      </p>
      <div className="field">
        <label htmlFor="exp-receipt">Receipt photo (optional)</label>
        <input
          id="exp-receipt"
          name="receipt"
          type="file"
          accept="image/*"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        {fileName ? <span className="small muted">{fileName}</span> : null}
      </div>
      {state && "error" in state ? (
        <div className="note warn" role="alert">
          {state.error}
        </div>
      ) : null}
      {state && "ok" in state ? (
        <div className="note" role="status">
          <Icon name="check" />
          <span>Saved.</span>
        </div>
      ) : null}
      <SubmitButton className="btn btn-primary btn-block" pendingText="Saving…">
        Save cost
      </SubmitButton>
    </form>
  );
}
