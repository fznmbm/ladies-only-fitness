import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "organiser" | "helper";
export type StaffMember = { id: string; email: string | null; name: string | null; role: StaffRole };

/**
 * Who is signed in on the organiser side, and whether they're the organiser or
 * a helper. Null if they're signed in but not on the staff list.
 * Cached for one page load, so every part of the page shares one lookup.
 */
export const getStaff = cache(async (): Promise<StaffMember | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  const { data: row } = await supabase
    .from("staff")
    .select("name, role")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (!row) return null;
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    name: (row.name as string | null) ?? null,
    role: row.role === "helper" ? "helper" : "organiser",
  };
});

/** For things only the organiser may do. The database checks this too. */
export async function requireOrganiser(): Promise<StaffMember> {
  const staff = await getStaff();
  if (!staff || staff.role !== "organiser")
    throw new Error("Only the organiser can do that.");
  return staff;
}
