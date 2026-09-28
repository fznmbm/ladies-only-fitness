import { createAdminClient } from "@/lib/supabase/admin";
import { ensureSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

// Runs every night (see vercel.json) so the coming weeks' sessions always exist,
// even if nobody taps "Add sessions". Vercel sends the CRON_SECRET with the request;
// anyone else gets turned away.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  const added = await ensureSessions(createAdminClient());
  return Response.json({ ok: true, added });
}
