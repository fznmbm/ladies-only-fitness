import { createAdminClient } from "@/lib/supabase/admin";

/** The group a join link is for: the one named in it, or the only group running. */
export async function joinableGroup(groupId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("groups")
    .select("id, name")
    .eq("active", true)
    .order("sort")
    .order("created_at");
  const groups = (data ?? []) as { id: string; name: string }[];
  if (groupId) return groups.find((g) => g.id === groupId) ?? null;
  return groups.length === 1 ? groups[0] : null;
}
