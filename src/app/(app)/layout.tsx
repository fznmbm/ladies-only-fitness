import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staff";
import { Nav } from "@/components/Nav";
import { GroupSwitcher } from "@/components/GroupSwitcher";
import { getGroupContext } from "@/lib/groups";
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

  const staff = await getStaff();

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

  const { active, group } = await getGroupContext();
  if (!group) {
    return (
      <main className="login">
        <h1 className="title">One more step</h1>
        <p className="subtitle" style={{ marginTop: 10 }}>
          The groups update hasn&apos;t been added to the database yet. Run
          migration 009 in the Supabase SQL editor, then reload this page.
        </p>
      </main>
    );
  }

  return (
    <>
      <div className="shell org">
        <div className="org-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/livefit-mark.png" alt="LiveFit" width={22} height={30} />
          <GroupSwitcher groups={active} currentId={group.id} />
          {/* Who is signed in on this phone, and a way out. */}
          <form action={signOut} className="who">
            <span>{staff.name || (staff.role === "helper" ? "Helper" : "Organiser")}</span>
            <span aria-hidden="true">·</span>
            <button type="submit">Sign out</button>
          </form>
        </div>
        {children}
      </div>
      <Nav role={staff.role} />
    </>
  );
}
