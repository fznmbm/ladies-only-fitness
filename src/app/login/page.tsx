import Link from "next/link";
import { signIn, signOut } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getStaff } from "@/lib/staff";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const staff = await getStaff();

  // Already signed in on this phone: say who, and offer to switch account.
  if (staff) {
    const who = staff.name || staff.email || "the organiser";
    return (
      <main className="login">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/livefit-logo.png" alt="LiveFit Club" className="brand-logo" />
        <h1 className="title">You&apos;re signed in</h1>
        <p className="subtitle">
          As <strong>{who}</strong> ({staff.role === "helper" ? "helper" : "organiser"}).
        </p>
        <div className="stack" style={{ marginTop: 24 }}>
          <Link href="/sessions" className="btn btn-primary btn-block" style={{ minHeight: 52 }}>
            Continue as {staff.name || "me"}
          </Link>
          <form action={signOut}>
            <SubmitButton className="btn btn-outline btn-block" pendingText="Signing out…">
              Sign out and use another account
            </SubmitButton>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="login">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/livefit-logo.png" alt="LiveFit Club" className="brand-logo" />
      <h1 className="title">Sign in</h1>
      <p className="subtitle">For the organiser and helpers.</p>
      <form action={signIn} className="stack" style={{ marginTop: 24 }}>
        {error ? (
          <div className="note warn" role="alert">
            That email or password didn&apos;t work. Check them and try again.
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <SubmitButton
          className="btn btn-primary btn-block"
          style={{ minHeight: 52 }}
          pendingText="Signing in…"
        >
          Sign in
        </SubmitButton>
      </form>
    </main>
  );
}
