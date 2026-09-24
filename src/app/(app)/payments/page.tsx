import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addMonths, formatMonth, monthStart, todayISO } from "@/lib/dates";
import { pounds } from "@/lib/money";
import { voidPayment } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import type { Member, Plan } from "@/lib/types";
import { PaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string }>;
}) {
  const { month: m, error } = await searchParams;
  const thisMonth = monthStart(todayISO());
  const month = m && /^\d{4}-\d{2}-01$/.test(m) ? m : thisMonth;

  const supabase = await createClient();
  const [{ data: subsData }, { data: membersData }, { data: plansData }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*, members(name)")
      .eq("month", month)
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false }),
    supabase.from("members").select("id, name").eq("status", "active").order("name"),
    supabase.from("plans").select("*").eq("active", true).order("sort").order("sessions_per_week"),
  ]);

  const subs = (subsData ?? []) as unknown as {
    id: string;
    sessions_per_week: number;
    price_pence: number;
    method: string;
    status: string;
    members: { name: string } | null;
  }[];
  const plans = (plansData ?? []) as Plan[];
  const members = (membersData ?? []) as Pick<Member, "id" | "name">[];
  const total = subs.filter((s) => s.status === "confirmed").reduce((sum, s) => sum + s.price_pence, 0);

  const months = [
    { value: thisMonth, label: formatMonth(thisMonth) },
    { value: addMonths(thisMonth, 1), label: formatMonth(addMonths(thisMonth, 1)) },
  ];

  return (
    <>
      <PageHead title="Payments" />

      {error ? (
        <div className="note warn" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <details className="details" open={subs.length === 0 || !!error}>
        <summary>
          <Icon name="plus" /> Record a payment
        </summary>
        <div className="body">
          {plans.length === 0 ? (
            <div className="note warn">
              Add a plan in Settings first, then you can record payments.
            </div>
          ) : (
            <PaymentForm members={members} plans={plans} months={months} defaultMonth={month === thisMonth || month === months[1].value ? month : thisMonth} />
          )}
        </div>
      </details>

      <div className="cluster" style={{ justifyContent: "space-between", margin: "22px 0 8px" }}>
        <Link href={`/payments?month=${addMonths(month, -1)}`} className="btn btn-quiet btn-small" aria-label="Previous month">
          <Icon name="back" size={18} />
        </Link>
        <h2 style={{ fontWeight: 700, fontSize: 17 }}>{formatMonth(month)}</h2>
        <Link href={`/payments?month=${addMonths(month, 1)}`} className="btn btn-quiet btn-small" aria-label="Next month">
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="back" size={18} />
          </span>
        </Link>
      </div>
      <p className="muted small" style={{ marginBottom: 10 }}>
        {pounds(total)} received from {subs.filter((s) => s.status === "confirmed").length} payments
      </p>

      {subs.length === 0 ? (
        <div className="card empty">No payments recorded for {formatMonth(month)}.</div>
      ) : (
        <ul className="list">
          {subs.map((s) => (
            <li key={s.id} className="row-main">
              <div className="grow">
                <div className="name">{s.members?.name ?? "Unknown"}</div>
                <div className="sub">
                  {s.sessions_per_week} a week, {s.method === "cash" ? "cash" : "bank transfer"}
                  {s.status === "pending" ? ", pending" : ""}
                </div>
              </div>
              <div className="name">{pounds(s.price_pence)}</div>
              <form action={voidPayment}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="btn btn-quiet btn-small" aria-label={`Remove payment from ${s.members?.name ?? "this lady"}`}>
                  <Icon name="x" size={18} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
