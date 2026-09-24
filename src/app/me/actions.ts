"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMember } from "@/lib/memberAuth";
import { uploadReceipt } from "@/lib/b2";
import type { Plan } from "@/lib/types";

/** A lady tapping "I'm coming" or "Can't make it" on her own page. */
export async function setRsvp(formData: FormData) {
  const member = await getMember();
  if (!member) return;

  const sessionId = String(formData.get("sessionId") ?? "");
  const coming = String(formData.get("coming") ?? "") === "true";
  if (!sessionId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("rsvps")
    .upsert(
      { session_id: sessionId, member_id: member.id, coming },
      { onConflict: "session_id,member_id" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/me");
}

/** Taps her own button again to clear it, going back to undecided. */
export async function clearRsvp(formData: FormData) {
  const member = await getMember();
  if (!member) return;

  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("rsvps")
    .delete()
    .eq("session_id", sessionId)
    .eq("member_id", member.id);
  if (error) throw new Error(error.message);

  revalidatePath("/me");
}

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

export type PayState = { ok: true } | { error: string } | null;

/** She picks a plan, transfers the money herself, then uploads the receipt here. */
export async function payForMonth(
  _prev: PayState,
  formData: FormData,
): Promise<PayState> {
  const member = await getMember();
  if (!member)
    return { error: "Your link has expired. Ask the organiser for a new one." };

  const planId = String(formData.get("planId") ?? "");
  const month = String(formData.get("month") ?? "");
  const receipt = formData.get("receipt");

  if (!/^\d{4}-\d{2}-01$/.test(month))
    return { error: "Something went wrong. Please try again." };
  if (!(receipt instanceof File) || receipt.size === 0) {
    return { error: "Please choose a photo of your receipt." };
  }
  if (!receipt.type.startsWith("image/")) {
    return {
      error: "Please upload a photo, like a screenshot of the transfer.",
    };
  }
  if (receipt.size > MAX_RECEIPT_BYTES) {
    return {
      error: "That photo is too large. Try a smaller photo or a screenshot.",
    };
  }

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("active", true)
    .maybeSingle();
  if (!plan) return { error: "Please choose a plan." };
  const p = plan as Plan;

  let receiptPath: string;
  try {
    receiptPath = await uploadReceipt(receipt, member.id);
  } catch {
    return {
      error:
        "Couldn't upload that photo. Please check your connection and try again.",
    };
  }

  const { error } = await admin.from("subscriptions").insert({
    member_id: member.id,
    plan_id: p.id,
    month,
    sessions_per_week: p.sessions_per_week,
    price_pence: p.price_pence,
    method: "transfer",
    status: "pending",
    receipt_path: receiptPath,
  });
  if (error) {
    if (error.message.includes("subscriptions_one_per_month")) {
      return {
        error:
          "You already have a payment for that month, waiting or confirmed.",
      };
    }
    return { error: "Couldn't save that. Please try again." };
  }

  revalidatePath("/me");
  return { ok: true };
}
