import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, formatTime } from "@/lib/dates";
import {
  addGroup,
  addHelper,
  addPlan,
  addSlot,
  deleteSlot,
  removeHelper,
  renameGroup,
  savePlan,
  setGroupActive,
  setPlanActive,
  updateSlot,
} from "@/app/actions";
import { signOut } from "@/app/login/actions";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { InstallHint } from "@/components/InstallHint";
import { ShareToWhatsApp } from "@/components/ShareToWhatsApp";
import { joinLink, siteOrigin } from "@/lib/config";
import { getGroupContext, requireGroup } from "@/lib/groups";
import type { Plan, Slot } from "@/lib/types";

export const dynamic = "force-dynamic";

function DayTimeFields({ prefix, slot }: { prefix: string; slot?: Slot }) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${prefix}-weekday`}>Day</label>
          <select
            id={`${prefix}-weekday`}
            name="weekday"
            defaultValue={String(slot?.weekday ?? 1)}
          >
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-time`}>Time</label>
          <input
            id={`${prefix}-time`}
            name="time"
            type="time"
            defaultValue={slot?.start_time.slice(0, 5)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-title`}>Name (optional)</label>
        <input
          id={`${prefix}-title`}
          name="title"
          defaultValue={slot?.title}
          placeholder="Workout session"
        />
      </div>
    </>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    timetable?: string;
    n?: string;
    error?: string;
    team?: string;
  }>;
}) {
  const { timetable, n, error, team } = await searchParams;
  // Money and settings are for the organiser only.
  if ((await getStaff())?.role !== "organiser") redirect("/sessions");

  const supabase = await createClient();
  const group = await requireGroup();
  const { groups } = await getGroupContext();

  const [
    { data: plansData },
    { data: slotsData },
    { data: staffData },
    { data: activityData },
  ] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .eq("group_id", group.id)
      .order("sort")
      .order("sessions_per_week"),
    supabase
      .from("schedule_slots")
      .select("*")
      .eq("group_id", group.id)
      .order("weekday")
      .order("start_time"),
    supabase.from("staff").select("user_id, name, role").order("role").order("name"),
    supabase
      .from("activity_log")
      .select("id, at, staff_name, action, detail")
      .order("at", { ascending: false })
      .limit(40),
  ]);
  const me = await getStaff();
  const staffList = (staffData ?? []) as {
    user_id: string;
    name: string | null;
    role: string;
  }[];
  const activity = (activityData ?? []) as {
    id: number;
    at: string;
    staff_name: string | null;
    action: string;
    detail: string | null;
  }[];
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const plans = (plansData ?? []) as Plan[];
  const slots = (slotsData ?? []) as Slot[];
  const active = plans.filter((p) => p.active);
  const archived = plans.filter((p) => !p.active);
  const liveGroups = groups.filter((g) => g.active);
  const pausedGroups = groups.filter((g) => !g.active);

  const invite = joinLink(await siteOrigin(), group.id);
  const inviteText = `Hi ladies! To join ${group.name} online, tap this link and enter your name and WhatsApp number. I'll send you your own link once I've checked it: ${invite}`;

  const changed = Number(n) || 0;
  const timetableNote =
    timetable === "added"
      ? "Added. Its sessions for the next 3 weeks are ready."
      : timetable === "changed"
        ? changed > 0
          ? `Saved. ${changed} upcoming ${changed === 1 ? "session was" : "sessions were"} updated to match.`
          : "Saved."
        : timetable === "removed"
          ? changed > 0
            ? `Removed, along with ${changed} upcoming ${changed === 1 ? "session" : "sessions"} nobody had been marked at.`
            : "Removed."
          : null;

  return (
    <>
      <PageHead title="Settings" sub={`For ${group.name}`} />

      {error ? (
        <div className="note warn" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Invite the ladies to {group.name}
      </h2>
      <div className="card stack">
        <p className="small muted">
          Post this in the group&apos;s WhatsApp chat. Each lady asks to join,
          and you approve her under Members.
        </p>
        <p className="small" style={{ wordBreak: "break-all" }}>
          {invite}
        </p>
        <ShareToWhatsApp text={inviteText}>
          <Icon name="send" size={18} /> Share in WhatsApp
        </ShareToWhatsApp>
      </div>

      <h2 className="section-title">This app on your phone</h2>
      <InstallHint />

      <h2 className="section-title">Weekly timetable</h2>
      {timetableNote ? (
        <div className="note" role="status" style={{ marginBottom: 12 }}>
          <Icon name="check" />
          <span>
            {timetableNote}{" "}
            <Link href="/share">Send the ladies the new times</Link>.
          </span>
        </div>
      ) : null}
      {slots.length === 0 ? (
        <div className="note" style={{ marginBottom: 12 }}>
          <Icon name="clock" />
          <span>
            Add each weekly session here. Sessions are then made automatically
            for the next 3 weeks, and kept topped up every night.
          </span>
        </div>
      ) : (
        <ul className="list" style={{ marginBottom: 12 }}>
          {slots.map((s) => (
            <li key={s.id}>
              <div className="row-main" style={{ minHeight: 60 }}>
                <div className="grow">
                  <div className="name">
                    {WEEKDAYS[s.weekday - 1]}, {formatTime(s.start_time)}
                  </div>
                  <div className="sub">{s.title}</div>
                </div>
                <form action={deleteSlot}>
                  <input type="hidden" name="id" value={s.id} />
                  <ConfirmSubmit
                    className="btn btn-quiet btn-small"
                    aria-label={`Remove ${WEEKDAYS[s.weekday - 1]} ${formatTime(s.start_time)}`}
                    confirm={`Remove ${WEEKDAYS[s.weekday - 1]} ${formatTime(s.start_time)} from the weekly timetable? Its upcoming sessions that nobody has been marked at are removed too.`}
                  >
                    <Icon name="x" size={18} />
                  </ConfirmSubmit>
                </form>
              </div>
              <details className="details" style={{ margin: "0 14px 14px" }}>
                <summary>Change day, time or name</summary>
                <form action={updateSlot}>
                  <input type="hidden" name="id" value={s.id} />
                  <DayTimeFields prefix={`slot-${s.id}`} slot={s} />
                  <p className="small muted" style={{ marginBottom: 12 }}>
                    Upcoming sessions nobody has been marked at yet move too.
                    If the day or time changes, their &ldquo;I&apos;m
                    coming&rdquo; answers are cleared. Sessions you moved by
                    hand stay as they are.
                  </p>
                  <SubmitButton
                    className="btn btn-primary btn-block"
                    pendingText="Saving…"
                  >
                    Save change
                  </SubmitButton>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      <details className="details">
        <summary>
          <Icon name="plus" /> Add a weekly session
        </summary>
        <form action={addSlot}>
          <DayTimeFields prefix="new-slot" />
          <SubmitButton
            className="btn btn-primary btn-block"
            pendingText="Adding…"
          >
            Add to timetable
          </SubmitButton>
        </form>
      </details>

      <h2 className="section-title" style={{ marginTop: 32 }}>
        Plans and prices
      </h2>
      <div className="note" style={{ marginBottom: 12 }}>
        <Icon name="clock" />
        <span>
          Plans run for the calendar month and only count {group.name}{" "}
          sessions. New prices only apply to payments recorded from now on.
        </span>
      </div>

      <div className="stack">
        {active.map((p) => (
          <div key={p.id} className="card stack">
            <form action={savePlan} className="stack">
              <input type="hidden" name="id" value={p.id} />
              <div className="field">
                <label htmlFor={`name-${p.id}`}>Name</label>
                <input
                  id={`name-${p.id}`}
                  name="name"
                  defaultValue={p.name}
                  required
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor={`sessions-${p.id}`}>Sessions a week</label>
                  <input
                    id={`sessions-${p.id}`}
                    name="sessions"
                    type="number"
                    min={1}
                    max={7}
                    defaultValue={p.sessions_per_week}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`price-${p.id}`}>Price a month (£)</label>
                  <input
                    id={`price-${p.id}`}
                    name="price"
                    inputMode="decimal"
                    defaultValue={p.price_pence / 100}
                    required
                  />
                </div>
              </div>
              <SubmitButton
                className="btn btn-primary btn-block"
                pendingText="Saving…"
              >
                Save changes
              </SubmitButton>
            </form>
            <form action={setPlanActive}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="active" value="false" />
              <SubmitButton
                className="btn btn-quiet btn-block btn-small"
                pendingText="Saving…"
              >
                Stop offering this plan
              </SubmitButton>
            </form>
          </div>
        ))}

        <details className="details">
          <summary>
            <Icon name="plus" /> Add a plan
          </summary>
          <form action={addPlan}>
            <div className="field">
              <label htmlFor="new-name">Name</label>
              <input id="new-name" name="name" placeholder="e.g. 2 a week" />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="new-sessions">Sessions a week</label>
                <input
                  id="new-sessions"
                  name="sessions"
                  type="number"
                  min={1}
                  max={7}
                  defaultValue={2}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-price">Price a month (£)</label>
                <input
                  id="new-price"
                  name="price"
                  inputMode="decimal"
                  required
                />
              </div>
            </div>
            <SubmitButton
              className="btn btn-primary btn-block"
              pendingText="Adding…"
            >
              Add plan
            </SubmitButton>
          </form>
        </details>

        {archived.length > 0 ? (
          <details className="details">
            <summary>Plans no longer offered</summary>
            <div className="body">
              {archived.map((p) => (
                <form
                  key={p.id}
                  action={setPlanActive}
                  className="cluster"
                  style={{ justifyContent: "space-between" }}
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value="true" />
                  <span>
                    {p.name}, £{p.price_pence / 100}
                  </span>
                  <SubmitButton
                    className="btn btn-outline btn-small"
                    pendingText="Saving…"
                  >
                    Offer again
                  </SubmitButton>
                </form>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <h2 className="section-title" style={{ marginTop: 32 }}>
        Groups
      </h2>
      <div className="note" style={{ marginBottom: 12 }}>
        <Icon name="users" />
        <span>
          Each group has its own timetable, plans, members and payments. Switch
          between them with the menu at the top of the screen.
        </span>
      </div>
      <ul className="list" style={{ marginBottom: 12 }}>
        {liveGroups.map((g) => (
          <li key={g.id}>
            <form
              action={renameGroup}
              className="row-main"
              style={{ gap: 8, minHeight: 64 }}
            >
              <input type="hidden" name="id" value={g.id} />
              <label htmlFor={`group-${g.id}`} className="sr-only">
                Group name
              </label>
              <input
                id={`group-${g.id}`}
                name="name"
                defaultValue={g.name}
                required
                maxLength={60}
                style={{ flex: 1 }}
              />
              <SubmitButton
                className="btn btn-outline btn-small"
                pendingText="…"
              >
                Save
              </SubmitButton>
            </form>
            {liveGroups.length > 1 ? (
              <form action={setGroupActive} style={{ padding: "0 14px 12px" }}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="active" value="false" />
                <ConfirmSubmit
                  className="btn btn-quiet btn-small"
                  confirm={`Stop running ${g.name}? It's hidden and no new sessions are made. Its history is kept, and you can bring it back any time.`}
                >
                  Stop running this group
                </ConfirmSubmit>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <details className="details">
        <summary>
          <Icon name="plus" /> Start a new group
        </summary>
        <form action={addGroup}>
          <div className="field">
            <label htmlFor="new-group">Name</label>
            <input
              id="new-group"
              name="name"
              required
              maxLength={60}
              placeholder="e.g. Tuesday Morning Ladies"
            />
          </div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            You&apos;ll switch to it straight away, to add its timetable and
            plans.
          </p>
          <SubmitButton
            className="btn btn-primary btn-block"
            pendingText="Adding…"
          >
            Start group
          </SubmitButton>
        </form>
      </details>
      {pausedGroups.length > 0 ? (
        <details className="details" style={{ marginTop: 12 }}>
          <summary>Groups not running</summary>
          <div className="body">
            {pausedGroups.map((g) => (
              <form
                key={g.id}
                action={setGroupActive}
                className="cluster"
                style={{ justifyContent: "space-between" }}
              >
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="active" value="true" />
                <span>{g.name}</span>
                <SubmitButton
                  className="btn btn-outline btn-small"
                  pendingText="Saving…"
                >
                  Run again
                </SubmitButton>
              </form>
            ))}
          </div>
        </details>
      ) : null}

      <h2 className="section-title" id="team" style={{ marginTop: 32 }}>
        Team
      </h2>
      {team === "added" ? (
        <div className="note" role="status" style={{ marginBottom: 12 }}>
          <Icon name="check" />
          <span>
            Helper added. Send her the email and password; she signs in on the
            same sign-in page as you.
          </span>
        </div>
      ) : null}
      <div className="note" style={{ marginBottom: 12 }}>
        <Icon name="users" />
        <span>
          Helpers can take the register, add walk-ins and take cash at the
          door. They can&apos;t see payments or accounts, change settings, or
          delete anyone.
        </span>
      </div>
      <ul className="list" style={{ marginBottom: 12 }}>
        {staffList.map((p) => (
          <li key={p.user_id} className="row-main" style={{ minHeight: 60 }}>
            <div className="grow">
              <div className="name">
                {p.name || "Organiser"}
                {p.user_id === me?.id ? " (you)" : ""}
              </div>
              <div className="sub">{p.role === "helper" ? "Helper" : "Organiser"}</div>
            </div>
            {p.role === "helper" ? (
              <form action={removeHelper}>
                <input type="hidden" name="userId" value={p.user_id} />
                <ConfirmSubmit
                  className="btn btn-quiet btn-small"
                  confirm={`Remove ${p.name || "this helper"}? Her login stops working straight away.`}
                >
                  Remove
                </ConfirmSubmit>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <details className="details">
        <summary>
          <Icon name="plus" /> Add a helper
        </summary>
        <form action={addHelper}>
          <div className="field">
            <label htmlFor="helper-name">Name</label>
            <input id="helper-name" name="name" required maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor="helper-email">Email</label>
            <input
              id="helper-email"
              name="email"
              type="email"
              autoComplete="off"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="helper-password">Password for her (8+ characters)</label>
            <input
              id="helper-password"
              name="password"
              type="text"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Send her the email and password privately. She can use them on any
            phone.
          </p>
          <SubmitButton className="btn btn-primary btn-block" pendingText="Adding…">
            Add helper
          </SubmitButton>
        </form>
      </details>

      <h2 className="section-title" style={{ marginTop: 32 }}>
        Recent activity
      </h2>
      {activity.length === 0 ? (
        <div className="card empty">
          Payments, deletions, cancellations and other changes will be listed
          here.
        </div>
      ) : (
        <details className="details">
          <summary>Show the last {activity.length} changes</summary>
          <ul className="list" style={{ margin: "0 14px 14px" }}>
            {activity.map((a) => (
              <li key={a.id} className="row-main" style={{ minHeight: 56 }}>
                <div className="grow">
                  <div className="name">{a.action}</div>
                  <div className="sub">
                    {a.detail ? `${a.detail}. ` : ""}
                    {when.format(new Date(a.at))}
                    {a.staff_name ? `, by ${a.staff_name}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <form action={signOut} style={{ marginTop: 32 }}>
        <SubmitButton
          className="btn btn-quiet btn-block"
          pendingText="Signing out…"
        >
          Sign out
        </SubmitButton>
      </form>
    </>
  );
}
