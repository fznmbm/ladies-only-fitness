import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Member } from "@/lib/types";

export const MEMBER_COOKIE = "member_token";

/** A long random secret that goes in the personal link. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Only a fingerprint is stored, so the database never holds a usable link. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function memberByToken(token: string): Promise<Member | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("*")
    .eq("login_token_hash", hashToken(token))
    .eq("status", "active")
    .maybeSingle();
  return (data ?? null) as Member | null;
}

/** The lady signed in on this phone, or null. */
export async function getMember(): Promise<Member | null> {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  return memberByToken(token);
}
