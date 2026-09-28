import { createAdminClient } from "@/lib/supabase/admin";
import { ensureSessions } from "@/lib/sessions";
import { deleteReceipt } from "@/lib/b2";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Receipt photos are kept for 6 months (see the privacy notice), then deleted. */
const KEEP_RECEIPTS_DAYS = 183;

// The nightly jobs (see vercel.json). Vercel sends the CRON_SECRET with the
// request; anyone else gets turned away.
//  1. Makes the coming weeks' sessions, so they always exist.
//  2. Deletes payment receipt photos older than 6 months. The payment itself is
//     kept; only the photo goes. (Receipts for the organiser's own costs are
//     kept, because they're business records.)
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  const admin = createAdminClient();
  const added = await ensureSessions(admin);

  const cutoff = new Date(Date.now() - KEEP_RECEIPTS_DAYS * 86_400_000).toISOString();
  const { data: old } = await admin
    .from("subscriptions")
    .select("id, receipt_path")
    .not("receipt_path", "is", null)
    .lt("created_at", cutoff)
    .limit(200);
  let receiptsDeleted = 0;
  for (const row of (old ?? []) as { id: string; receipt_path: string }[]) {
    try {
      await deleteReceipt(row.receipt_path);
      await admin.from("subscriptions").update({ receipt_path: null }).eq("id", row.id);
      receiptsDeleted++;
    } catch (e) {
      console.error("Couldn't delete old receipt", row.id, e);
    }
  }

  return Response.json({ ok: true, added, receiptsDeleted });
}
