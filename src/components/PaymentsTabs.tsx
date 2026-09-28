import Link from "next/link";

/** Switches between taking payments and the accounts summary. */
export function PaymentsTabs({ active }: { active: "payments" | "accounts" }) {
  return (
    <nav className="filters" aria-label="Payments or accounts" style={{ marginBottom: 16 }}>
      <Link
        href="/payments"
        className={active === "payments" ? "filter on" : "filter"}
        aria-current={active === "payments" ? "page" : undefined}
      >
        Payments
      </Link>
      <Link
        href="/payments/accounts"
        className={active === "accounts" ? "filter on" : "filter"}
        aria-current={active === "accounts" ? "page" : undefined}
      >
        Accounts
      </Link>
    </nav>
  );
}
