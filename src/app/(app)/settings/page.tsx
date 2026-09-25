import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, formatTime } from "@/lib/dates";
import {
  addPlan,
  addSlot,
  deleteSlot,
  savePlan,
  setPlanActive,
} from "@/app/actions";
import { signOut } from "@/app/login/actions";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";
import { InstallHint } from "@/components/InstallHint";
import { ShareToWhatsApp } from "@/components/ShareToWhatsApp";
import { groupName, joinLink, siteOrigin } from "@/lib/config";
import type { Plan, Slot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: plansData }, { data: slotsData }] = await Promise.all([
    supabase.from("plans").select("*").order("sort").order("sessions_per_week"),
    supabase
      .from("schedule_slots")
      .select("*")
      .order("weekday")
      .order("start_time"),
  ]);
  const plans = (plansData ?? []) as Plan[];
  const slots = (slotsData ?? []) as Slot[];
  const active = plans.filter((p) => p.active);
  const archived = plans.filter((p) => !p.active);

  const invite = joinLink(await siteOrigin());
  const inviteText = `Hi ladies! To join ${groupName()} online, tap this link and enter your name and WhatsApp number. I'll send you your own link once I've checked it: ${invite}`;
  // const inviteWa = `https://wa.me/?text=${encodeURIComponent(inviteText)}`;

  return (
    <>
      <PageHead title="Settings" />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Invite the ladies
      </h2>
      <div className="card stack">
        <p className="small muted">
          Post this in the WhatsApp group. Each lady asks to join, and you
          approve her under Members.
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

      <h2 className="section-title">Plans and prices</h2>
      <div className="note" style={{ marginBottom: 12 }}>
        <Icon name="clock" />
        <span>
          Plans run for the calendar month. New prices only apply to payments
          recorded from now on.
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
        Weekly timetable
      </h2>
      {slots.length === 0 ? (
        <div className="note" style={{ marginBottom: 12 }}>
          <Icon name="clock" />
          <span>
            Add each weekly session here, then create sessions from the Sessions
            screen.
          </span>
        </div>
      ) : (
        <ul className="list" style={{ marginBottom: 12 }}>
          {slots.map((s) => (
            <li key={s.id} className="row-main" style={{ minHeight: 60 }}>
              <div className="grow">
                <div className="name">
                  {WEEKDAYS[s.weekday - 1]}, {formatTime(s.start_time)}
                </div>
                <div className="sub">{s.title}</div>
              </div>
              <form action={deleteSlot}>
                <input type="hidden" name="id" value={s.id} />
                <SubmitButton
                  className="btn btn-quiet btn-small"
                  aria-label={`Remove ${WEEKDAYS[s.weekday - 1]} ${formatTime(s.start_time)}`}
                >
                  <Icon name="x" size={18} />
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <details className="details">
        <summary>
          <Icon name="plus" /> Add a weekly session
        </summary>
        <form action={addSlot}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="weekday">Day</label>
              <select id="weekday" name="weekday" defaultValue="1">
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="slot-time">Time</label>
              <input id="slot-time" name="time" type="time" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="slot-title">Name (optional)</label>
            <input id="slot-title" name="title" placeholder="Workout session" />
          </div>
          <SubmitButton
            className="btn btn-primary btn-block"
            pendingText="Adding…"
          >
            Add to timetable
          </SubmitButton>
        </form>
      </details>

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
