import type { Db } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staff";

/**
 * Adds a line to the record of who did what (Settings > Recent activity).
 * Never stops the action itself if the record can't be written.
 */
export async function logActivity(
  supabase: Db,
  action: string,
  detail: string,
  groupId: string | null = null,
) {
  try {
    const staff = await getStaff();
    await supabase.from("activity_log").insert({
      action,
      detail: detail.slice(0, 300),
      group_id: groupId,
      staff_name: staff?.name || staff?.email || null,
    });
  } catch {
    // The record is helpful, not essential.
  }
}
