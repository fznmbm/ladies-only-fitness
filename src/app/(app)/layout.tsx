import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // The middleware has already checked the sign-in; this reads it without asking
  // Supabase again. The staff lookup below is still protected by the database rules.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims
    ? { id: data.claims.sub, email: data.claims.email }
    : null;
  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("staff")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) {
    return (
      <main className="login">
        <h1 className="title">Not set up yet</h1>
        <p className="subtitle" style={{ marginTop: 10 }}>
          {user.email} can sign in, but hasn&apos;t been added as organiser or
          helper. Ask the person who set up the app to add this account to the
          staff list.
        </p>
        <form action={signOut} style={{ marginTop: 24 }}>
          <SubmitButton className="btn btn-outline" pendingText="Signing out…">
            Sign out
          </SubmitButton>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="shell">{children}</div>
      <Nav />
    </>
  );
}
