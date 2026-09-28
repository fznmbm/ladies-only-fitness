import { createAdminClient } from "@/lib/supabase/admin";

type JoinGroup = { id: string; name: string };

/** The group a join link is for: the one named in it, or the only group running. */
export async function joinableGroup(
  groupId: string,
): Promise<JoinGroup | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("groups")
    .select("id, name")
    .eq("active", true)
    .order("sort")
    .order("created_at");
  const groups = (data ?? []) as JoinGroup[];
  if (groupId) return groups.find((g) => g.id === groupId) ?? null;
  return groups.length === 1 ? groups[0] : null;
}

/** The group a short join link is for, e.g. /join/livefitclub-7a3f. */
export async function groupBySlug(slug: string): Promise<JoinGroup | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("groups")
    .select("id, name")
    .eq("join_slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as JoinGroup | null) ?? null;
}
