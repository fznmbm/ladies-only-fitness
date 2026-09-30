import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";

/** Remembers which group the organiser is looking at, on this phone. */
export const GROUP_COOKIE = "group";

/**
 * The groups and the one the organiser is working in right now.
 * Cached for the length of one page load, so every part of the page
 * shares a single lookup.
 */
export const getGroupContext = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name, sort, active, join_slug, dropin_pence")
    .order("sort")
    .order("created_at");
  const groups = (data ?? []) as Group[];
  const active = groups.filter((g) => g.active);
  const chosen = (await cookies()).get(GROUP_COOKIE)?.value;
  const group =
    active.find((g) => g.id === chosen) ?? active[0] ?? groups[0] ?? null;
  return { groups, active, group };
});

/** The current group, for pages that can't work without one. */
export async function requireGroup(): Promise<Group> {
  const { group } = await getGroupContext();
  if (!group)
    throw new Error("No group has been set up yet. Run migration 009.");
  return group;
}
