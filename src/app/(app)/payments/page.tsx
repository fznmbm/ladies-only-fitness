import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { addMonths, formatMonth, monthStart, todayISO } from "@/lib/dates";
import { pounds } from "@/lib/money";
import { confirmPayment, voidPayment } from "@/app/actions";
import { receiptViewUrl } from "@/lib/b2";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { PaymentsTabs } from "@/components/PaymentsTabs";
import { requireGroup } from "@/lib/groups";
import type { Member, Plan } from "@/lib/types";
import { PaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string }>;
}) {
  const { month: m, error } = await searchParams;
  // Money and settings are for the organiser only.
  if ((await getStaff())?.role !== "organiser") redirect("/sessions");

  const thisMonth = monthStart(todayISO());
  const month = m && /^\d{4}-\d{2}-01$/.test(m) ? m : thisMonth;

  const supabase = await createClient();
  const group = await requireGroup();
  const [{ data: subsData }, { data: membersData }, { data: plansData }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("*, members(name, pay_ref)")
        .eq("group_id", group.id)
        .eq("month", month)
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false }),
      supabase
        .from("member_groups")
        .select("members(id, name, status)")
        .eq("group_id", group.id)
        .eq("status", "active"),
      supabase
        .from("plans")
        .select("*")
        .eq("group_id", group.id)
        .eq("active", true)
        .order("sort")
        .order("sessions_per_week"),
    ]);

  const subs = (subsData ?? []) as unknown as {
    id: string;
    sessions_per_week: number;
    price_pence: number;
    method: string;
    status: string;
    receipt_path: string | null;
    members: { name: string; pay_ref: string | null } | null;
  }[];
  const plans = (plansData ?? []) as Plan[];
  const members = (
    (membersData ?? []) as unknown as {
      members: Pick<Member, "id" | "name" | "status"> | null;
    }[]
  )
    .map((r) => r.members)
    .filter(
      (m): m is Pick<Member, "id" | "name" | "status"> =>
        !!m && m.status === "active",
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const total = subs
    .filter((s) => s.status === "confirmed")
    .reduce((sum, s) => sum + s.price_pence, 0);

  const toConfirm = subs.filter((s) => s.status === "pending");
  const confirmed = subs.filter((s) => s.status === "confirmed");
  const receiptUrls = new Map<string, string>();
  for (const s of toConfirm) {
    if (s.receipt_path) {
      try {
        receiptUrls.set(s.id, await receiptViewUrl(s.receipt_path));
      } catch {
        // The photo just won't show; Confirm and Not received still work.
      }
    }
  }

  const months = [
    { value: thisMonth, label: formatMonth(thisMonth) },
    {
      value: addMonths(thisMonth, 1),
      label: formatMonth(addMonths(thisMonth, 1)),
    },
  ];

  return (
    <>
      <PageHead title="Payments" />
      <PaymentsTabs active="payments" />

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
              Add a plan for {group.name} in Settings first, then you can
              record payments.
            </div>
          ) : (
            <PaymentForm
              members={members}
              plans={plans}
              months={months}
              defaultMonth={
                month === thisMonth || month === months[1].value
                  ? month
                  : thisMonth
              }
            />
          )}
        </div>
      </details>

      <div
        className="cluster"
        style={{ justifyContent: "space-between", margin: "22px 0 8px" }}
      >
        <Link
          href={`/payments?month=${addMonths(month, -1)}`}
          className="btn btn-quiet btn-small"
          aria-label="Previous month"
        >
          <Icon name="back" size={18} />
        </Link>
        <h2 style={{ fontWeight: 700, fontSize: 17 }}>{formatMonth(month)}</h2>
        <Link
          href={`/payments?month=${addMonths(month, 1)}`}
          className="btn btn-quiet btn-small"
          aria-label="Next month"
        >
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="back" size={18} />
          </span>
        </Link>
      </div>
      <p className="muted small" style={{ marginBottom: 10 }}>
        {pounds(total)} received from{" "}
        {subs.filter((s) => s.status === "confirmed").length} payments
      </p>

      {toConfirm.length > 0 ? (
        <>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            To confirm {toConfirm.length}
          </h2>
          <div className="stack" style={{ marginBottom: 20 }}>
            {toConfirm.map((s) => {
              const url = receiptUrls.get(s.id);
              return (
                <div key={s.id} className="card">
                  <div
                    className="cluster"
                    style={{ flexWrap: "nowrap", gap: 14 }}
                  >
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ flexShrink: 0 }}
                      >
                        <img
                          src={url}
                          alt={`Receipt from ${s.members?.name ?? "this lady"}`}
                          style={{
                            width: 60,
                            height: 76,
                            borderRadius: 10,
                            objectFit: "cover",
                            background: "var(--sand)",
                          }}
                        />
                      </a>
                    ) : (
                      <span
                        className="avatar"
                        style={{ width: 60, height: 76, borderRadius: 10 }}
                        aria-hidden="true"
                      >
                        <Icon name="clip" size={22} />
                      </span>
                    )}
                    <div className="grow">
                      <div className="name">{s.members?.name ?? "Unknown"}</div>
                      <div className="sub">
                        {s.sessions_per_week} a week,{" "}
                        {s.method === "cash" ? "cash" : "bank transfer"}
                      </div>
                      {s.members?.pay_ref ? (
                        <div className="sub">
                          Look for reference <strong>{s.members.pay_ref}</strong>
                        </div>
                      ) : null}
                      <div className="name" style={{ marginTop: 8 }}>
                        {pounds(s.price_pence)}
                      </div>
                    </div>
                  </div>
                  <div
                    className="cluster"
                    style={{ marginTop: 12, gap: 10, flexWrap: "nowrap" }}
                  >
                    <form action={confirmPayment} style={{ flex: 1 }}>
                      <input type="hidden" name="id" value={s.id} />
                      <SubmitButton
                        className="btn btn-primary btn-block"
                        pendingText="Confirming…"
                      >
                        <Icon name="check" size={18} /> Confirm
                      </SubmitButton>
                    </form>
                    <form action={voidPayment} style={{ flex: 1 }}>
                      <input type="hidden" name="id" value={s.id} />
                      <SubmitButton
                        className="btn btn-outline btn-block"
                        pendingText="Saving…"
                      >
                        Not received
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {confirmed.length === 0 && toConfirm.length === 0 ? (
        <div className="card empty">
          No payments recorded for {formatMonth(month)}.
        </div>
      ) : confirmed.length > 0 ? (
        <>
          <h2 className="section-title">Confirmed</h2>
          <ul className="list">
            {confirmed.map((s) => (
              <li key={s.id} className="row-main">
                <div className="grow">
                  <div className="name">{s.members?.name ?? "Unknown"}</div>
                  <div className="sub">
                    {s.sessions_per_week} a week,{" "}
                    {s.method === "cash" ? "cash" : "bank transfer"}
                  </div>
                </div>
                <div className="name">{pounds(s.price_pence)}</div>
                <form action={voidPayment}>
                  <input type="hidden" name="id" value={s.id} />
                  <ConfirmSubmit
                    className="btn btn-quiet btn-small"
                    aria-label={`Remove payment from ${s.members?.name ?? "this lady"}`}
                    confirm={`Remove ${s.members?.name ?? "this lady"}'s ${pounds(s.price_pence)} payment? She'll show as not paid for this month.`}
                  >
                    <Icon name="x" size={18} />
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
