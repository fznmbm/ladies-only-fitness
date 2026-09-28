"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { joinableGroup } from "@/lib/joinableGroup";

function str(f: FormData, key: string): string {
  return String(f.get(key) ?? "").trim();
}

export async function requestToJoin(formData: FormData) {
  const code = str(formData, "code");
  const groupId = str(formData, "g");
  const needed = process.env.JOIN_CODE;

  // Hidden field that only bots fill in.
  if (str(formData, "website")) redirect(`/join?sent=1`);

  if (needed && code !== needed) redirect("/join");

  const name = str(formData, "name").slice(0, 80);
  const phone = str(formData, "phone").slice(0, 30);

  // Carries the code, group and whatever she typed back to the form, so a
  // problem never means retyping everything.
  const params = new URLSearchParams();
  if (groupId) params.set("g", groupId);
  if (code) params.set("code", code);
  if (name) params.set("name", name);
  if (phone) params.set("phone", phone);

  const group = await joinableGroup(groupId);
  if (!group) redirect(`/join?${params.toString()}`);

  const tidyPhone = normalizePhone(phone);
  if (!name || !tidyPhone) {
    params.set("problem", "1");
    redirect(`/join?${params.toString()}`);
  }

  const admin = createAdminClient();
  const fail = () => {
    params.set("problem", "2");
    redirect(`/join?${params.toString()}`);
  };

  // Someone with this number may already be in the app (another group, or
  // already asked). Either way she just asks to join this group too.
  // The reply is the same in every case, so the form can't be used to find out
  // who is already a member.
  const { data: existing } = await admin
    .from("members")
    .select("id")
    .eq("phone", tidyPhone)
    .maybeSingle();

  let memberId = existing?.id as string | undefined;
  if (!memberId) {
    const { data: created, error } = await admin
      .from("members")
      .insert({ name, phone: tidyPhone, status: "pending" })
      .select("id")
      .single();
    if (error || !created) fail();
    memberId = created!.id as string;
  }

  const { error: e2 } = await admin
    .from("member_groups")
    .upsert(
      { member_id: memberId, group_id: group!.id, status: "pending" },
      { onConflict: "member_id,group_id", ignoreDuplicates: true },
    );
  if (e2) fail();

  redirect("/join?sent=1");
}
