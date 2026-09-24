import { createClient } from "@supabase/supabase-js";

/**
 * Full-access client that skips the row-level security rules.
 * Server only. Use it just for the public join form and the ladies' own screens,
 * and always limit queries to the one lady who is signed in.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
