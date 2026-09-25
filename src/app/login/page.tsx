import { signIn } from "./actions";
import { groupName } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="group-name">{groupName()}</div>
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
