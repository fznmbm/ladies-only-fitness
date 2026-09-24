"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

function str(f: FormData, key: string): string {
  return String(f.get(key) ?? "").trim();
}

export async function requestToJoin(formData: FormData) {
  const code = str(formData, "code");
  const needed = process.env.JOIN_CODE;

  // Hidden field that only bots fill in.
  if (str(formData, "website")) redirect(`/join?sent=1`);

  if (needed && code !== needed) redirect("/join");

  const name = str(formData, "name").slice(0, 80);
  const phone = str(formData, "phone").slice(0, 30);

  // Carries the code and whatever she typed back to the form, so a problem
  // never means retyping everything.
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  if (name) params.set("name", name);
  if (phone) params.set("phone", phone);

  if (!name || phone.replace(/\D/g, "").length < 8) {
    params.set("problem", "1");
    redirect(`/join?${params.toString()}`);
  }

  const { error } = await createAdminClient().from("members").insert({ name, phone, status: "pending" });
  // A duplicate WhatsApp number just means someone already asked to join with it.
  // Treat that the same as success, so the form can't be used to find out who is
  // already a member. Any other database error is shown, not swallowed.
  if (error && !error.message.includes("members_phone_key")) {
    params.set("problem", "2");
    redirect(`/join?${params.toString()}`);
  }
  redirect("/join?sent=1");
}
