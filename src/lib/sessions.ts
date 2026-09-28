import type { SupabaseClient } from "@supabase/supabase-js";

/** How many weeks ahead sessions are created, counting this week. */
export const WEEKS_AHEAD = 3;

/**
 * Creates the sessions from each group's weekly timetable for this week and the
 * next two. The database skips any that already exist, including ones moved or
 * cancelled by hand, so those changes always stick (see migration 009).
 * Used by the "Add sessions" button and by the nightly job.
 * Returns how many new sessions were added.
 */
export async function ensureSessions(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("ensure_sessions", { p_weeks: WEEKS_AHEAD });
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}
