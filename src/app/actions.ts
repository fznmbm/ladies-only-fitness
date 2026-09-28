"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, type Db } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  WEEKDAYS,
  addMonths,
  formatDate,
  formatTime,
  monthName,
  monthStart,
  todayISO,
} from "@/lib/dates";
import { pounds, toPence } from "@/lib/money";
import { APP_FULL_NAME, siteOrigin } from "@/lib/config";
import { hashToken, newToken } from "@/lib/memberAuth";
import { normalizePhone, whatsappUrl } from "@/lib/phone";
import {
  deleteMemberReceipts,
  deleteReceipt,
  uploadExpenseReceipt,
} from "@/lib/b2";
import { ensureSessions } from "@/lib/sessions";
import { GROUP_COOKIE, requireGroup } from "@/lib/groups";
import { getStaff, requireOrganiser } from "@/lib/staff";
import { logActivity } from "@/lib/activity";
import { EXPENSE_CATEGORIES, type Plan } from "@/lib/types";

/** "Zumba, Wed 1 Oct 7:00 pm", for the activity record. */
function describeSession(s: {
  title: string;
  session_date: string;
  start_time: string;
}) {
  return `${s.title}, ${formatDate(s.session_date)} ${formatTime(s.start_time)}`;
}

async function isOrganiser(): Promise<boolean> {
  return (await getStaff())?.role === "organiser";
}

function refresh() {
  revalidatePath("/", "layout");
}

function str(f: FormData, key: string): string {
  return String(f.get(key) ?? "").trim();
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/**
 * Once someone pays for a month in a group, her "pay later" visits to that
 * group's sessions in that month are settled.
 */
async function settlePayLater(
  supabase: Db,
  memberId: string,
  groupId: string,
  month: string,
) {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("group_id", groupId)
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

/** Puts a lady in a group (or approves her request to join it). */
async function joinGroup(supabase: Db, memberId: string, groupId: string) {
  const { error } = await supabase
    .from("member_groups")
    .upsert(
      { member_id: memberId, group_id: groupId, status: "active" },
      { onConflict: "member_id,group_id" },
    );
  check(error);
}

// ---------- Groups ----------

/** The group switcher at the top of the organiser's screens. */
export async function setCurrentGroup(formData: FormData) {
  const id = str(formData, "groupId");
  if (id) {
    (await cookies()).set(GROUP_COOKIE, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  refresh();
  const back = str(formData, "back");
  // Only ever go back to one of the app's own organiser pages.
  redirect(
    /^\/(sessions|members|payments|share|settings)(\/|$)/.test(back)
      ? back.split("?")[0]
      : "/sessions",
  );
}

export async function addGroup(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const name = str(formData, "name");
  if (!name) return;
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, sort: 100 })
    .select("id")
    .single();
  check(error);
  if (!data) return;
  // Switch straight to the new group, so its plans and timetable can be set up.
  (await cookies()).set(GROUP_COOKIE, data.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
}

export async function renameGroup(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const name = str(formData, "name");
  if (!name) return;
  const { error } = await supabase
    .from("groups")
    .update({ name })
    .eq("id", str(formData, "id"));
  check(error);
  refresh();
}

/** A new short join link for a group. The old one stops working straight away. */
export async function newJoinLink(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const groupId = str(formData, "id");
  // Clearing it makes the database pick a fresh one.
  const { error } = await supabase
    .from("groups")
    .update({ join_slug: null })
    .eq("id", groupId);
  check(error);
  await logActivity(supabase, "Made a new join link", "", groupId);
  refresh();
}

export async function setGroupActive(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const active = str(formData, "active") === "true";
  if (!active) {
    // There must always be at least one group in use.
    const { count } = await supabase
      .from("groups")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if ((count ?? 0) <= 1)
      redirect(
        "/settings?error=" +
          encodeURIComponent("You need at least one group in use."),
      );
  }
  const { error } = await supabase
    .from("groups")
    .update({ active })
    .eq("id", str(formData, "id"));
  check(error);
  refresh();
}

// ---------- Sessions ----------

/** The "Add sessions from the weekly timetable" button. A nightly job does the same. */
export async function generateSessions() {
  await requireOrganiser();
  const supabase = await createClient();
  await ensureSessions(supabase);
  refresh();
}

export async function addSession(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const group = await requireGroup();
  const date = str(formData, "date");
  const time = str(formData, "time");
  if (!date || !time) return;
  const { error } = await supabase.from("sessions").insert({
    group_id: group.id,
    session_date: date,
    start_time: time,
    title: str(formData, "title") || "Workout session",
  });
  if (error && !error.message.includes("sessions_group_date_time"))
    check(error);
  refresh();
}

/**
 * Moves one session to another date or time (or renames it), for example when
 * the hall isn't available that week. "I'm coming" answers are cleared if the
 * date or time changes, because they were for the old time. The nightly job
 * won't put the original back.
 */
export async function moveSession(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const id = str(formData, "sessionId");
  const date = str(formData, "date");
  const time = str(formData, "time").slice(0, 5);
  const title = str(formData, "title") || "Workout session";
  const back = (msg: string) =>
    redirect(`/sessions/${id}?error=` + encodeURIComponent(msg));

  const [{ data: session }, { count: attended }] = await Promise.all([
    supabase
      .from("sessions")
      .select("session_date, start_time, cancelled")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", id),
  ]);
  if (!session) back("That session no longer exists.");
  if (!date || !/^\d{2}:\d{2}$/.test(time)) back("Choose a date and a time.");
  if ((attended ?? 0) > 0)
    back(
      "Ladies have already been marked here, so this session can't be moved.",
    );
  if (date < todayISO()) back("A session can't be moved into the past.");

  const oldDate = session!.session_date as string;
  const oldTime = String(session!.start_time).slice(0, 5);
  const moved = oldDate !== date || oldTime !== time;

  const { error } = await supabase
    .from("sessions")
    .update({ session_date: date, start_time: time, title })
    .eq("id", id);
  if (error)
    back(
      error.message.includes("sessions_group_date_time")
        ? "There's already a session at that date and time."
        : error.message,
    );

  if (moved) {
    const { error: e2 } = await supabase
      .from("rsvps")
      .delete()
      .eq("session_id", id);
    check(e2);
  }
  await logActivity(
    supabase,
    moved ? "Moved session" : "Renamed session",
    moved
      ? `${title}: ${formatDate(oldDate)} ${formatTime(oldTime)} to ${formatDate(date)} ${formatTime(time)}`
      : title,
  );
  refresh();
  redirect(
    moved ? `/sessions/${id}?moved=${oldDate}T${oldTime}` : `/sessions/${id}`,
  );
}

/** Cancels one session, with an optional reason the ladies will see. */
export async function cancelSession(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const id = str(formData, "sessionId");
  const reason = str(formData, "reason").slice(0, 120) || null;
  const { data: cancelled, error } = await supabase
    .from("sessions")
    .update({ cancelled: true, cancel_reason: reason })
    .eq("id", id)
    .select("title, session_date, start_time, group_id")
    .maybeSingle();
  check(error);
  if (cancelled)
    await logActivity(
      supabase,
      "Cancelled session",
      describeSession(cancelled) + (reason ? ` (${reason})` : ""),
      cancelled.group_id,
    );
  refresh();
  redirect(`/sessions/${id}?cancelled=1`);
}

/** Brings a cancelled session back. */
export async function restoreSession(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const id = str(formData, "sessionId");
  const { data: restored, error } = await supabase
    .from("sessions")
    .update({ cancelled: false, cancel_reason: null })
    .eq("id", id)
    .select("title, session_date, start_time, group_id")
    .maybeSingle();
  if (restored)
    await logActivity(
      supabase,
      "Brought session back",
      describeSession(restored),
      restored.group_id,
    );
  if (error)
    redirect(
      `/sessions/${id}?error=` +
        encodeURIComponent(
          error.message.includes("sessions_group_date_time")
            ? "Another session has been added at that date and time, so this one can't come back."
            : error.message,
        ),
    );
  refresh();
}

// ---------- Register ----------

/**
 * Tap "Here": marks her present, or takes it back if she is already marked.
 * The database does the whole check in one call (see migration 009).
 * If cash was taken for this visit, it is kept rather than removed.
 */
export async function toggleHere(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_here", {
    p_session_id: str(formData, "sessionId"),
    p_member_id: str(formData, "memberId"),
  });
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
      .select("session_date, group_id")
      .eq("id", sessionId)
      .single(),
  ]);
  if (!plan || !session) return;
  const p = plan as Plan;
  if (p.group_id !== session.group_id) return;
  const month = monthStart(session.session_date);

  const { error } = await supabase.from("subscriptions").insert({
    member_id: memberId,
    group_id: session.group_id,
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
  await settlePayLater(supabase, memberId, session.group_id, month);
  const { data: m } = await supabase
    .from("members")
    .select("name")
    .eq("id", memberId)
    .maybeSingle();
  await logActivity(
    supabase,
    "Cash for a plan at the door",
    `${m?.name ?? "someone"}, ${p.name} ${pounds(p.price_pence)} for ${monthName(month)}`,
    session.group_id,
  );
  refresh();
}

export async function addWalkIn(formData: FormData) {
  const supabase = await createClient();
  const sessionId = str(formData, "sessionId");
  const name = str(formData, "name");
  // Tidied the same way the database stores it, so "07700 900123" finds
  // someone saved as "+447700900123".
  const typed = str(formData, "phone");
  const phone = normalizePhone(typed) ?? (typed || null);
  if (!name || !sessionId) return;

  // Same rule as the "Here" button: no marking cancelled or future sessions.
  const { data: session } = await supabase
    .from("sessions")
    .select("session_date, cancelled, group_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.cancelled || session.session_date > todayISO())
    return;

  // Same number as someone already in the app? Mark her here under her existing
  // name instead of adding her twice, and add her to this group if she isn't in it.
  if (phone) {
    const { data: existing } = await supabase
      .from("members")
      .select("id, status")
      .eq("phone", phone)
      .maybeSingle();
    if (existing) {
      if (existing.status !== "active") {
        const { error } = await supabase
          .from("members")
          .update({
            status: "active",
            ...(existing.status === "pending"
              ? { approved_at: new Date().toISOString() }
              : {}),
          })
          .eq("id", existing.id);
        check(error);
      }
      await joinGroup(supabase, existing.id, session.group_id);
      const { data: already } = await supabase
        .from("attendance")
        .select("id")
        .eq("session_id", sessionId)
        .eq("member_id", existing.id)
        .maybeSingle();
      if (!already) {
        // Uses the same check as the "Here" button, so her plan is taken into account.
        const { error } = await supabase.rpc("toggle_here", {
          p_session_id: sessionId,
          p_member_id: existing.id,
        });
        check(error);
      }
      refresh();
      return;
    }
  }

  const { data: member, error } = await supabase
    .from("members")
    .insert({ name, phone, status: "active" })
    .select("id")
    .single();
  check(error);
  if (!member) return;
  await joinGroup(supabase, member.id, session.group_id);

  const { error: e2 } = await supabase
    .from("attendance")
    .insert({ session_id: sessionId, member_id: member.id, flag: "no_plan" });
  check(e2);
  refresh();
}

// ---------- Members ----------

/** Adds a lady to the group being viewed. */
export async function addMember(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const group = await requireGroup();
  const name = str(formData, "name");
  if (!name) return;
  const { data, error } = await supabase
    .from("members")
    .insert({ name, phone: str(formData, "phone") || null, status: "active" })
    .select("id")
    .single();
  if (error) redirect("/members?error=" + encodeURIComponent(error.message));
  await joinGroup(supabase, data!.id, group.id);
  refresh();
}

export async function updateMember(formData: FormData) {
  await requireOrganiser();
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

/** On a member's page: add her to a group, or take her out of one. */
export async function setMemberGroup(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const memberId = str(formData, "memberId");
  const groupId = str(formData, "groupId");
  if (str(formData, "in") === "true") {
    await joinGroup(supabase, memberId, groupId);
  } else {
    const { error } = await supabase
      .from("member_groups")
      .delete()
      .eq("member_id", memberId)
      .eq("group_id", groupId);
    check(error);
  }
  refresh();
}

/**
 * Deletes a lady for good: her details, groups, payments, visits and RSVPs (the
 * database removes those with her), then her receipt photos from B2.
 * For someone who has just stopped coming, "No longer attending" is usually better,
 * because it keeps her payment history.
 */
export async function deleteMember(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const id = str(formData, "id");
  if (!id || str(formData, "confirm") !== "yes")
    redirect(
      `/members/${id}?error=` +
        encodeURIComponent("Tick the box to confirm before deleting."),
    );

  const { data: deleted, error } = await supabase
    .from("members")
    .delete()
    .eq("id", id)
    .select("id, name");
  if (error)
    redirect(`/members/${id}?error=` + encodeURIComponent(error.message));
  if (!deleted || deleted.length === 0)
    redirect(
      "/members?error=" +
        encodeURIComponent("That member was already removed."),
    );

  // Her record is gone, so do the photos now. If B2 fails, the photos are only
  // reachable with the organiser's keys, so don't stop the delete over it.
  try {
    await deleteMemberReceipts(id);
  } catch (e) {
    console.error("Couldn't remove receipts for deleted member", id, e);
  }
  await logActivity(supabase, "Deleted member", String(deleted[0].name ?? ""));

  refresh();
  redirect("/members");
}

// ---------- Payments ----------

export async function recordPayment(formData: FormData) {
  await requireOrganiser();
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
    group_id: p.group_id,
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
      ? "She already has a plan in this group for that month."
      : error.message;
    redirect("/payments?error=" + encodeURIComponent(msg));
  }
  await settlePayLater(supabase, memberId, p.group_id, month);
  const { data: m } = await supabase
    .from("members")
    .select("name")
    .eq("id", memberId)
    .maybeSingle();
  await logActivity(
    supabase,
    "Recorded payment",
    `${m?.name ?? "someone"}, ${pounds(toPence(str(formData, "amount")))} ${method} for ${monthName(month)}`,
    p.group_id,
  );
  refresh();
  redirect("/payments?month=" + month);
}

export async function voidPayment(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const id = str(formData, "id");
  const { data: before } = await supabase
    .from("subscriptions")
    .select("status, group_id, month, price_pence, members(name)")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "rejected" })
    .eq("id", id);
  check(error);
  if (before) {
    const who =
      (before.members as unknown as { name: string } | null)?.name ?? "someone";
    await logActivity(
      supabase,
      before.status === "pending" ? "Payment not received" : "Removed payment",
      `${who}, ${pounds(before.price_pence)} for ${monthName(before.month)}`,
      before.group_id,
    );
  }
  refresh();
}

/** She uploaded a receipt; the organiser checks it, then confirms it here. */
export async function confirmPayment(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const id = str(formData, "id");
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("member_id, group_id, month, price_pence, members(name)")
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  check(error);
  if (sub) {
    await settlePayLater(supabase, sub.member_id, sub.group_id, sub.month);
    const who =
      (sub.members as unknown as { name: string } | null)?.name ?? "someone";
    await logActivity(
      supabase,
      "Confirmed payment",
      `${who}, ${pounds(sub.price_pence)} for ${monthName(sub.month)}`,
      sub.group_id,
    );
  }
  refresh();
}

// ---------- Settings: plans ----------

export async function savePlan(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("plans")
    .update({
      name: str(formData, "name"),
      sessions_per_week: Number(str(formData, "sessions")) || 1,
      price_pence: toPence(str(formData, "price")),
    })
    .eq("id", str(formData, "id"))
    .select("name, sessions_per_week, price_pence, group_id")
    .maybeSingle();
  check(error);
  if (saved)
    await logActivity(
      supabase,
      "Changed plan",
      `${saved.name}: ${saved.sessions_per_week} a week, ${pounds(saved.price_pence)} a month`,
      saved.group_id,
    );
  refresh();
}

/** Adds a plan to the group being viewed. */
export async function addPlan(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const group = await requireGroup();
  const sessions = Number(str(formData, "sessions")) || 1;
  const name = str(formData, "name") || `${sessions} a week`;
  const { error } = await supabase.from("plans").insert({
    group_id: group.id,
    name,
    sessions_per_week: sessions,
    price_pence: toPence(str(formData, "price")),
    sort: 100,
  });
  check(error);
  refresh();
}

export async function setPlanActive(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ active: str(formData, "active") === "true" })
    .eq("id", str(formData, "id"));
  check(error);
  refresh();
}

// ---------- Settings: weekly timetable ----------

/** Adds a weekly session to the group being viewed, and creates its sessions. */
export async function addSlot(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const group = await requireGroup();
  const time = str(formData, "time");
  if (!time) return;
  const { error } = await supabase.from("schedule_slots").insert({
    group_id: group.id,
    weekday: Number(str(formData, "weekday")) || 1,
    start_time: time,
    title: str(formData, "title") || "Workout session",
  });
  check(error);
  await ensureSessions(supabase);
  refresh();
  redirect("/settings?timetable=added");
}

/** Changes a weekly session. Its upcoming sessions follow (see migration 009). */
export async function updateSlot(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_slot", {
    p_slot_id: str(formData, "id"),
    p_weekday: Number(str(formData, "weekday")) || 1,
    p_start_time: str(formData, "time"),
    p_title: str(formData, "title") || "Workout session",
  });
  check(error);
  await logActivity(
    supabase,
    "Changed weekly timetable",
    `${str(formData, "title") || "Workout session"}, now ${WEEKDAYS[(Number(str(formData, "weekday")) || 1) - 1]} ${formatTime(str(formData, "time"))}`,
  );
  refresh();
  redirect(`/settings?timetable=changed&n=${Number(data) || 0}`);
}

/** Removes a weekly session and its upcoming sessions nobody has attended yet. */
export async function deleteSlot(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const slotId = str(formData, "id");
  const { data: slot } = await supabase
    .from("schedule_slots")
    .select("weekday, start_time, title, group_id")
    .eq("id", slotId)
    .maybeSingle();
  const { data, error } = await supabase.rpc("remove_slot", {
    p_slot_id: slotId,
  });
  check(error);
  if (slot)
    await logActivity(
      supabase,
      "Removed from weekly timetable",
      `${slot.title}, ${WEEKDAYS[slot.weekday - 1]} ${formatTime(slot.start_time)}`,
      slot.group_id,
    );
  refresh();
  redirect(`/settings?timetable=removed&n=${Number(data) || 0}`);
}

// ---------- Ladies' personal links ----------

export type LinkState =
  | { url: string; wa: string | null }
  | { ok: string }
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
    `Hi ${first}, here's your personal link for ${APP_FULL_NAME}: ${url}\n\n` +
    `Tap it once, then add it to your home screen. It's just for you, so please don't share it.`;
  return { url, wa: whatsappUrl(member.phone, text) };
}

export async function makeLoginLink(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  if (!(await isOrganiser()))
    return { error: "Only the organiser can do that." };
  const supabase = await createClient();
  return issueLink(supabase, str(formData, "memberId"));
}

/**
 * Approves a lady's request to join a group. A new lady gets her personal link.
 * Someone already using the app just sees the new group in it, and keeps her
 * current link (a new one would stop her installed app from working).
 */
export async function approveRequest(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  if (!(await isOrganiser()))
    return { error: "Only the organiser can do that." };
  const supabase = await createClient();
  const memberId = str(formData, "memberId");
  const groupId = str(formData, "groupId");

  const { data: member } = await supabase
    .from("members")
    .select("status, login_token_hash")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return { error: "Couldn't find that request." };

  const { error: e1 } = await supabase
    .from("member_groups")
    .update({ status: "active" })
    .eq("member_id", memberId)
    .eq("group_id", groupId);
  if (e1) return { error: e1.message };

  if (member.status !== "active") {
    const { error } = await supabase
      .from("members")
      .update({ status: "active", approved_at: new Date().toISOString() })
      .eq("id", memberId);
    if (error) return { error: error.message };
  }
  // No refresh here on purpose: the row stays on screen so the link can be sent.
  if (member.login_token_hash)
    return { ok: "She's in. The group now shows in her app." };
  return issueLink(supabase, memberId);
}

/**
 * Declines a request to join a group. A brand-new lady (in no other group)
 * is removed completely; anyone else just isn't added to this group.
 */
export async function declineRequest(formData: FormData) {
  const supabase = await createClient();
  const memberId = str(formData, "memberId");
  const groupId = str(formData, "groupId");
  const { error } = await supabase
    .from("member_groups")
    .delete()
    .eq("member_id", memberId)
    .eq("group_id", groupId)
    .eq("status", "pending");
  check(error);
  const { count } = await supabase
    .from("member_groups")
    .select("group_id", { count: "exact", head: true })
    .eq("member_id", memberId);
  if ((count ?? 0) === 0) {
    const { error: e2 } = await supabase
      .from("members")
      .delete()
      .eq("id", memberId)
      .eq("status", "pending");
    check(e2);
  }
  refresh();
}

// ---------- Accounts: costs ----------

export type ExpenseState = { ok: true } | { error: string } | null;

/**
 * Records a cost, such as hall hire. It can be for the group being viewed or
 * shared by all groups, and a bulk payment can be spread over several months.
 */
export async function addExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  if (!(await isOrganiser()))
    return { error: "Only the organiser can do that." };
  const supabase = await createClient();
  const group = await requireGroup();

  const amount = toPence(str(formData, "amount"));
  const paidOn = str(formData, "paidOn");
  const coversFrom = str(formData, "coversFrom");
  const months = Math.round(Number(str(formData, "months")) || 1);
  const category = str(formData, "category");
  const receipt = formData.get("receipt");

  if (!(amount > 0)) return { error: "Enter how much it cost." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn))
    return { error: "Enter the date you paid." };
  if (!/^\d{4}-\d{2}-01$/.test(coversFrom))
    return { error: "Choose which month it's for." };
  if (months < 1 || months > 24)
    return { error: "It can cover 1 to 24 months." };
  if (!(category in EXPENSE_CATEGORIES))
    return { error: "Choose what it was for." };

  let receiptPath: string | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    if (!receipt.type.startsWith("image/"))
      return { error: "The receipt needs to be a photo." };
    try {
      receiptPath = await uploadExpenseReceipt(receipt);
    } catch {
      return {
        error:
          "Couldn't upload the receipt photo. Try again, or save without it.",
      };
    }
  }

  const { error } = await supabase.from("expenses").insert({
    group_id: str(formData, "scope") === "all" ? null : group.id,
    category,
    description: str(formData, "description").slice(0, 120) || null,
    amount_pence: amount,
    paid_on: paidOn,
    covers_from: coversFrom,
    covers_months: months,
    receipt_path: receiptPath,
  });
  if (error) {
    if (receiptPath) await deleteReceipt(receiptPath).catch(() => {});
    return { error: error.message };
  }
  await logActivity(
    supabase,
    "Added cost",
    `${EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES]} ${pounds(amount)}` +
      (months > 1 ? ` over ${months} months` : "") +
      (str(formData, "scope") === "all" ? ", shared by all groups" : ""),
    str(formData, "scope") === "all" ? null : group.id,
  );
  refresh();
  return { ok: true };
}

export async function deleteExpense(formData: FormData) {
  await requireOrganiser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", str(formData, "id"))
    .select("receipt_path, category, amount_pence, group_id");
  check(error);
  const gone = data?.[0] as
    | {
        receipt_path: string | null;
        category: string;
        amount_pence: number;
        group_id: string | null;
      }
    | undefined;
  if (gone?.receipt_path)
    await deleteReceipt(gone.receipt_path).catch(() => {});
  if (gone)
    await logActivity(
      supabase,
      "Removed cost",
      `${EXPENSE_CATEGORIES[gone.category as keyof typeof EXPENSE_CATEGORIES] ?? "Cost"} ${pounds(gone.amount_pence)}`,
      gone.group_id,
    );
  refresh();
}

// ---------- Team: helpers at the door ----------

/**
 * Gives someone a helper login: they sign in on the same page with this email
 * and password, and can take the register but not touch money or settings.
 */
export async function addHelper(formData: FormData) {
  await requireOrganiser();
  const name = str(formData, "name").slice(0, 60);
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const back = (msg: string) =>
    redirect("/settings?error=" + encodeURIComponent(msg) + "#team");
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    back("Enter the helper's name and email address.");
  if (password.length < 8) back("The password needs at least 8 characters.");

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !created.user)
    back(
      error?.message.toLowerCase().includes("already")
        ? "That email already has a login."
        : `Couldn't add the helper: ${error?.message ?? "unknown problem"}`,
    );
  const { error: e2 } = await admin
    .from("staff")
    .insert({ user_id: created.user!.id, name, role: "helper" });
  if (e2) {
    await admin.auth.admin.deleteUser(created.user!.id).catch(() => {});
    back(`Couldn't add the helper: ${e2.message}`);
  }
  const supabase = await createClient();
  await logActivity(supabase, "Added helper", `${name} (${email})`);
  refresh();
  redirect("/settings?team=added#team");
}

/** Removes a helper's login completely. The organiser can't be removed here. */
export async function removeHelper(formData: FormData) {
  const me = await requireOrganiser();
  const userId = str(formData, "userId");
  if (!userId || userId === me.id) return;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("staff")
    .select("name, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || row.role !== "helper") return;
  const { error } = await admin.from("staff").delete().eq("user_id", userId);
  check(error);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
  const supabase = await createClient();
  await logActivity(supabase, "Removed helper", String(row.name ?? ""));
  refresh();
}
