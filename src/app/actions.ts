"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, type Db } from "@/lib/supabase/server";
import { memberContext } from "@/lib/coverage";
import {
  addDays,
  addMonths,
  monthStart,
  todayISO,
  weekStart,
} from "@/lib/dates";
import { toPence } from "@/lib/money";
import { groupName, siteOrigin } from "@/lib/config";
import { hashToken, newToken } from "@/lib/memberAuth";
import { whatsappUrl } from "@/lib/phone";
import type { Plan } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

function str(f: FormData, key: string): string {
  return String(f.get(key) ?? "").trim();
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Once someone pays for a month, "pay later" visits in that month are settled. */
async function settlePayLater(supabase: Db, memberId: string, month: string) {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id")
    .gte("session_date", month)
    .lt("session_date", addMonths(month, 1));
  const ids = ((sessions ?? []) as { id: string }[]).map((s) => s.id);
  if (ids.length === 0) return;
  await supabase
    .from("attendance")
    .update({ resolution: "settled" })
    .eq("member_id", memberId)
    .eq("resolution", "pay_later")
    .in("session_id", ids);
}

// ---------- Sessions ----------

export async function generateSessions() {
  const supabase = await createClient();
  const { data: slots } = await supabase.from("schedule_slots").select("*");
  if (!slots || slots.length === 0) return;

  const today = todayISO();
  const start = weekStart(today);
  const rows: { session_date: string; start_time: string; title: string }[] =
    [];
  for (let week = 0; week < 4; week++) {
    for (const s of slots as {
      weekday: number;
      start_time: string;
      title: string;
    }[]) {
      const date = addDays(start, week * 7 + (s.weekday - 1));
      if (date < today) continue;
      rows.push({
        session_date: date,
        start_time: s.start_time,
        title: s.title,
      });
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase
      .from("sessions")
      .upsert(rows, {
        onConflict: "session_date,start_time",
        ignoreDuplicates: true,
      });
    check(error);
  }
  refresh();
}

export async function addSession(formData: FormData) {
  const supabase = await createClient();
  const date = str(formData, "date");
  const time = str(formData, "time");
  if (!date || !time) return;
  const { error } = await supabase
    .from("sessions")
    .upsert(
      {
        session_date: date,
        start_time: time,
        title: str(formData, "title") || "Workout session",
      },
      { onConflict: "session_date,start_time", ignoreDuplicates: true },
    );
  check(error);
  refresh();
}

export async function setCancelled(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ cancelled: str(formData, "cancelled") === "true" })
    .eq("id", str(formData, "sessionId"));
  check(error);
  refresh();
}

// ---------- Register ----------

/** Tap "Here": marks her present, or takes it back if she is already marked. */
export async function toggleHere(formData: FormData) {
  const supabase = await createClient();
  const sessionId = str(formData, "sessionId");
  const memberId = str(formData, "memberId");

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("session_id", sessionId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", existing.id);
    check(error);
    refresh();
    return;
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("session_date")
    .eq("id", sessionId)
    .single();
  if (!session) return;

  const { sub, usedOthers } = await memberContext(
    supabase,
    memberId,
    sessionId,
    session.session_date,
  );
  let flag: "over_plan" | "no_plan" | null = null;
  if (!sub) flag = "no_plan";
  else if (usedOthers >= sub.sessions_per_week) flag = "over_plan";

  const { error } = await supabase
    .from("attendance")
    .insert({ session_id: sessionId, member_id: memberId, flag });
  check(error);
  refresh();
}

export async function undoHere(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("id", str(formData, "attendanceId"));
  check(error);
  refresh();
}

export async function allowOverPlan(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ resolution: "allowed" })
    .eq("id", str(formData, "attendanceId"));
  check(error);
  refresh();
}

export async function cashExtra(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({
      resolution: "cash",
      extra_paid_pence: toPence(str(formData, "amount")),
    })
    .eq("id", str(formData, "attendanceId"));
  check(error);
  refresh();
}

export async function payLater(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ resolution: "pay_later" })
    .eq("id", str(formData, "attendanceId"));
  check(error);
  refresh();
}

/** No plan at the door: record a cash payment for a plan covering this month. */
export async function cashPlan(formData: FormData) {
  const supabase = await createClient();
  const attendanceId = str(formData, "attendanceId");
  const sessionId = str(formData, "sessionId");
  const memberId = str(formData, "memberId");

  const [{ data: plan }, { data: session }] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .eq("id", str(formData, "planId"))
      .single(),
    supabase
      .from("sessions")
      .select("session_date")
      .eq("id", sessionId)
      .single(),
  ]);
  if (!plan || !session) return;
  const p = plan as Plan;
  const month = monthStart(session.session_date);

  const { error } = await supabase.from("subscriptions").insert({
    member_id: memberId,
    plan_id: p.id,
    month,
    sessions_per_week: p.sessions_per_week,
    price_pence: p.price_pence,
    method: "cash",
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });
  check(error);

  const { error: e2 } = await supabase
    .from("attendance")
    .update({ resolution: "cash" })
    .eq("id", attendanceId);
  check(e2);
  await settlePayLater(supabase, memberId, month);
  refresh();
}

export async function addWalkIn(formData: FormData) {
  const supabase = await createClient();
  const sessionId = str(formData, "sessionId");
  const name = str(formData, "name");
  if (!name) return;

  const { data: member, error } = await supabase
    .from("members")
    .insert({ name, phone: str(formData, "phone") || null, status: "active" })
    .select("id")
    .single();
  check(error);
  if (!member) return;

  const { error: e2 } = await supabase
    .from("attendance")
    .insert({ session_id: sessionId, member_id: member.id, flag: "no_plan" });
  check(e2);
  refresh();
}

// ---------- Members ----------

export async function addMember(formData: FormData) {
  const supabase = await createClient();
  const name = str(formData, "name");
  if (!name) return;
  const { error } = await supabase
    .from("members")
    .insert({ name, phone: str(formData, "phone") || null, status: "active" });
  if (error) redirect("/members?error=" + encodeURIComponent(error.message));
  refresh();
}

export async function updateMember(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData, "id");
  const { error } = await supabase
    .from("members")
    .update({
      name: str(formData, "name"),
      phone: str(formData, "phone") || null,
      notes: str(formData, "notes") || null,
      status: str(formData, "status") || "active",
    })
    .eq("id", id);
  if (error)
    redirect(`/members/${id}?error=` + encodeURIComponent(error.message));
  refresh();
}

// ---------- Payments ----------

export async function recordPayment(formData: FormData) {
  const supabase = await createClient();
  const memberId = str(formData, "memberId");
  const month = str(formData, "month");
  const method = str(formData, "method") === "transfer" ? "transfer" : "cash";

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", str(formData, "planId"))
    .single();
  if (!plan || !memberId || !month)
    redirect(
      "/payments?error=" +
        encodeURIComponent("Choose a lady, a plan and a month."),
    );
  const p = plan as Plan;

  const { error } = await supabase.from("subscriptions").insert({
    member_id: memberId,
    plan_id: p.id,
    month,
    sessions_per_week: p.sessions_per_week,
    price_pence: toPence(str(formData, "amount")),
    method,
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });
  if (error) {
    const msg = error.message.includes("subscriptions_one_per_month")
      ? "She already has a plan for that month."
      : error.message;
    redirect("/payments?error=" + encodeURIComponent(msg));
  }
  await settlePayLater(supabase, memberId, month);
  refresh();
  redirect("/payments?month=" + month);
}

export async function voidPayment(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "rejected" })
    .eq("id", str(formData, "id"));
  check(error);
  refresh();
}

/** She uploaded a receipt; the organiser checks it, then confirms it here. */
export async function confirmPayment(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData, "id");
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("member_id, month")
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  check(error);
  if (sub) await settlePayLater(supabase, sub.member_id, sub.month);
  refresh();
}

// ---------- Settings ----------

export async function savePlan(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: str(formData, "name"),
      sessions_per_week: Number(str(formData, "sessions")) || 1,
      price_pence: toPence(str(formData, "price")),
    })
    .eq("id", str(formData, "id"));
  check(error);
  refresh();
}

export async function addPlan(formData: FormData) {
  const supabase = await createClient();
  const sessions = Number(str(formData, "sessions")) || 1;
  const name = str(formData, "name") || `${sessions} a week`;
  const { error } = await supabase.from("plans").insert({
    name,
    sessions_per_week: sessions,
    price_pence: toPence(str(formData, "price")),
    sort: 100,
  });
  check(error);
  refresh();
}

export async function setPlanActive(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ active: str(formData, "active") === "true" })
    .eq("id", str(formData, "id"));
  check(error);
  refresh();
}

export async function addSlot(formData: FormData) {
  const supabase = await createClient();
  const time = str(formData, "time");
  if (!time) return;
  const { error } = await supabase.from("schedule_slots").insert({
    weekday: Number(str(formData, "weekday")) || 1,
    start_time: time,
    title: str(formData, "title") || "Workout session",
  });
  check(error);
  refresh();
}

export async function deleteSlot(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_slots")
    .delete()
    .eq("id", str(formData, "id"));
  check(error);
  refresh();
}

// ---------- Ladies' personal links ----------

export type LinkState =
  | { url: string; wa: string | null }
  | { error: string }
  | null;

/** Makes a fresh personal link for a lady. Any older link stops working. */
async function issueLink(supabase: Db, memberId: string): Promise<LinkState> {
  const { data: member } = await supabase
    .from("members")
    .select("id, name, phone")
    .eq("id", memberId)
    .single();
  if (!member) return { error: "Couldn't find that member." };

  const token = newToken();
  const { error } = await supabase
    .from("members")
    .update({ login_token_hash: hashToken(token) })
    .eq("id", memberId);
  if (error) return { error: error.message };

  const url = `${await siteOrigin()}/m/${token}`;
  const first = String(member.name).split(" ")[0];
  const text =
    `Hi ${first}, here's your personal link for ${groupName()}: ${url}\n\n` +
    `Tap it once, then add it to your home screen. It's just for you, so please don't share it.`;
  return { url, wa: whatsappUrl(member.phone, text) };
}

export async function makeLoginLink(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const supabase = await createClient();
  return issueLink(supabase, str(formData, "memberId"));
}

export async function approveRequest(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const supabase = await createClient();
  const memberId = str(formData, "memberId");
  const { error } = await supabase
    .from("members")
    .update({ status: "active", approved_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  // No refresh here on purpose: the row stays on screen so the link can be sent.
  return issueLink(supabase, memberId);
}

export async function declineRequest(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", str(formData, "memberId"))
    .eq("status", "pending");
  check(error);
  refresh();
}
