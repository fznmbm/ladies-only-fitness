import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, monthName, monthStart, todayISO } from "@/lib/dates";
import { pounds } from "@/lib/money";
import { deleteMember, setMemberGroup, updateMember } from "@/app/actions";
import { getGroupContext } from "@/lib/groups";
import { getStaff } from "@/lib/staff";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";
import { LoginLinkButton } from "@/components/LoginLink";
import { ShareToWhatsApp } from "@/components/ShareToWhatsApp";
import type { Member, Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  // Everything at once, instead of one after another.
  const [
    { data: memberRow },
    { data: subsData },
    { data: attData },
    { data: groupRows },
    { groups },
    { count: owesCount },
  ] = await Promise.all([
      supabase.from("members").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("*, groups(name)")
        .eq("member_id", id)
        .neq("status", "rejected")
        .order("month", { ascending: false })
        .limit(12),
      supabase
        .from("attendance")
        .select(
          "id, flag, resolution, extra_paid_pence, sessions(session_date, start_time, groups(name))",
        )
        .eq("member_id", id)
        // Newest first in the database, so the 20 shown really are the latest.
        .order("sessions(session_date)", { ascending: false })
        .order("sessions(start_time)", { ascending: false })
        .limit(20),
      supabase
        .from("member_groups")
        .select("group_id, status")
        .eq("member_id", id),
      getGroupContext(),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("member_id", id)
        .eq("resolution", "pay_later"),
    ]);
  if (!memberRow) notFound();
  const member = memberRow as Member;
  // Helpers can look up a lady at the door; only the organiser changes her details.
  const isOrganiser = (await getStaff())?.role === "organiser";

  const subs = (subsData ?? []) as (Subscription & {
    groups: { name: string } | null;
  })[];
  const inGroup = new Map(
    ((groupRows ?? []) as { group_id: string; status: string }[]).map((r) => [
      r.group_id,
      r.status,
    ]),
  );
  const liveGroups = groups.filter((g) => g.active);
  const manyGroups = liveGroups.length > 1;
  const visits = (
    (attData ?? []) as unknown as {
      id: string;
      flag: string | null;
      resolution: string | null;
      extra_paid_pence: number;
      sessions: {
        session_date: string;
        start_time: string;
        groups: { name: string } | null;
      };
    }[]
  )
    .sort((a, b) =>
      (b.sessions.session_date + b.sessions.start_time).localeCompare(
        a.sessions.session_date + a.sessions.start_time,
      ),
    )
    .slice(0, 20);

  // The summary at the top: this month's plan, last visit, anything owed.
  const month = monthStart(todayISO());
  const current = subs.find((s) => s.month === month) ?? null;
  const lastVisit = visits[0]?.sessions.session_date ?? null;
  const owed = owesCount ?? 0;
  const first = member.name.split(" ")[0];

  return (
    <>
      <Link href="/members" className="back" style={{ marginTop: 8 }}>
        <Icon name="back" /> Members
      </Link>
      <PageHead
        title={member.name}
        sub={[
          member.phone,
          member.pay_ref ? `ref ${member.pay_ref}` : null,
          member.status === "inactive" ? "no longer attending" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {error ? (
        <div className="note warn" role="alert" style={{ marginBottom: 12 }}>
          {error.includes("members_phone_key")
            ? "Someone with that number is already a member."
            : error}
        </div>
      ) : null}

      <div className="stats">
        <div className={current ? "stat" : "stat bad"}>
          <span>{monthName(month)}</span>
          <b>
            {current
              ? `${current.sessions_per_week} a week`
              : "Not paid"}
          </b>
          {current?.status === "pending" ? <small>payment pending</small> : null}
        </div>
        <div className="stat">
          <span>Last came</span>
          <b>{lastVisit ? formatDate(lastVisit).replace(/^\w+ /, "") : "Not yet"}</b>
        </div>
        <div className={owed > 0 ? "stat bad" : "stat"}>
          <span>Owes</span>
          <b>{owed > 0 ? `${owed} ${owed === 1 ? "visit" : "visits"}` : "Nothing"}</b>
        </div>
      </div>

      <div className="action-row">
        {member.phone ? (
          <ShareToWhatsApp
            text={`Hi ${first}, `}
            phone={member.phone}
            className="btn btn-outline"
            copiedLabel="Opening…"
          >
            <Icon name="send" size={18} /> Message
          </ShareToWhatsApp>
        ) : null}
        {isOrganiser ? (
          <Link href={`/payments?pay=${member.id}`} className="btn btn-outline">
            <Icon name="wallet" size={18} /> Record payment
          </Link>
        ) : null}
      </div>

      {isOrganiser && member.notes ? (
        <div className="note" style={{ marginTop: 12 }}>
          <Icon name="clip" />
          <span>{member.notes}</span>
        </div>
      ) : null}

      {isOrganiser && member.status === "active" ? (
        <div className="card stack" style={{ marginTop: 12 }}>
          <div>
            <div className="name">Her personal link</div>
            <p className="small muted" style={{ marginTop: 2 }}>
              Signs her in on her phone with no password. A new link stops the
              old one working.
            </p>
          </div>
          <LoginLinkButton
            memberId={member.id}
            label={
              member.phone ? "Send her a link on WhatsApp" : "Make her a link"
            }
          />
        </div>
      ) : null}

      {manyGroups ? (
      <>
      <h2 className="section-title">Groups</h2>
      <ul className="list">
        {liveGroups.map((g) => {
          const status = inGroup.get(g.id);
          return (
            <li key={g.id} className="row-main" style={{ minHeight: 60 }}>
              <div className="grow">
                <div className="name">{g.name}</div>
                <div className="sub">
                  {status === "active"
                    ? "Member"
                    : status === "pending"
                      ? "Asked to join, see Members"
                      : "Not in this group"}
                </div>
              </div>
              {isOrganiser ? (
              <form action={setMemberGroup}>
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="groupId" value={g.id} />
                <input
                  type="hidden"
                  name="in"
                  value={status === "active" ? "false" : "true"}
                />
                <SubmitButton
                  className={
                    status === "active"
                      ? "btn btn-quiet btn-small"
                      : "btn btn-outline btn-small"
                  }
                  pendingText="…"
                >
                  {status === "active" ? "Remove" : "Add"}
                </SubmitButton>
              </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      </>
      ) : null}

      <h2 className="section-title">Payments</h2>
      {subs.length === 0 ? (
        <div className="card empty">No payments yet.</div>
      ) : (
        <ul className="list">
          {subs.map((s) => (
            <li key={s.id} className="row-main">
              <div className="grow">
                <div className="name">
                  {monthName(s.month)}
                  {manyGroups && s.groups ? `, ${s.groups.name}` : ""}
                </div>
                <div className="sub">
                  {s.sessions_per_week} a week,{" "}
                  {s.method === "cash" ? "cash" : "bank transfer"}
                  {s.status === "pending" ? ", pending" : ""}
                </div>
              </div>
              <div className="name">{pounds(s.price_pence)}</div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Recent visits</h2>
      {visits.length === 0 ? (
        <div className="card empty">Hasn&apos;t been to a session yet.</div>
      ) : (
        <ul className="list">
          {visits.map((v) => (
            <li key={v.id} className="row-main" style={{ minHeight: 56 }}>
              <div className="grow">
                <div className="name">
                  {formatDate(v.sessions.session_date)},{" "}
                  {formatTime(v.sessions.start_time)}
                  {manyGroups && v.sessions.groups
                    ? `, ${v.sessions.groups.name}`
                    : ""}
                </div>
                {v.flag ? (
                  <div className="sub warn">
                    {v.resolution === "allowed"
                      ? "Over her plan, allowed"
                      : v.resolution === "cash"
                        ? v.flag === "over_plan"
                          ? `Over her plan, paid ${pounds(v.extra_paid_pence)} cash`
                          : "No plan, paid cash"
                        : v.resolution === "pay_later"
                          ? "Pays later"
                          : v.resolution === "settled"
                            ? "Paid later"
                            : "Needs a decision"}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOrganiser ? (
        <details className="details" style={{ marginTop: 28 }}>
          <summary>
            <Icon name="sliders" size={18} /> Edit her details
          </summary>
          <form action={updateMember}>
            <input type="hidden" name="id" value={member.id} />
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" defaultValue={member.name} required />
            </div>
            <div className="field">
              <label htmlFor="phone">WhatsApp number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={member.phone ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={member.status}>
                <option value="active">Active</option>
                <option value="inactive">No longer attending</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="notes">Notes for the organiser</label>
              <textarea id="notes" name="notes" defaultValue={member.notes ?? ""} />
            </div>
            <SubmitButton className="btn btn-primary btn-block" pendingText="Saving…">
              Save changes
            </SubmitButton>
          </form>
        </details>
      ) : null}

      {isOrganiser ? (
      <details className="details" style={{ marginTop: 12 }}>
        <summary>Delete this member</summary>
        <form action={deleteMember} className="stack">
          <input type="hidden" name="id" value={member.id} />
          <p className="small muted">
            This removes {member.name} completely: her payments, visits and
            receipt photos. It can&apos;t be undone. If she has just stopped
            coming, set her to &ldquo;No longer attending&rdquo; under Edit her details instead,
            which keeps her history.
          </p>
          <label
            className="cluster"
            style={{ alignItems: "center", flexWrap: "nowrap" }}
          >
            <input type="checkbox" name="confirm" value="yes" required />
            <span>Yes, delete {member.name} for good</span>
          </label>
          <SubmitButton
            className="btn btn-danger btn-block"
            pendingText="Deleting…"
          >
            Delete member
          </SubmitButton>
        </form>
      </details>
      ) : null}
    </>
  );
}
