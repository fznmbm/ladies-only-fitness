import { requestToJoin } from "./actions";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * The join form, shared by the short link (/join/livefitclub-7a3f) and the
 * older long one (/join?g=…&code=…). `group` is null when the link is wrong.
 */
export function JoinScreen({
  group,
  slug = "",
  g = "",
  code = "",
  sent,
  problem,
  name = "",
  phone = "",
}: {
  group: { id: string; name: string } | null;
  slug?: string;
  g?: string;
  code?: string;
  sent?: string;
  problem?: string;
  name?: string;
  phone?: string;
}) {
  return (
    <main className="shell">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/livefit-logo.png"
        alt="LiveFit Club"
        className="brand-logo"
        style={{ marginTop: 28, width: 120 }}
      />
      {sent ? (
        <>
          <PageHead title="Request sent" />
          <div className="note">
            Thank you. The organiser will check your request and send your
            personal link on WhatsApp.
          </div>
        </>
      ) : !group ? (
        <>
          <PageHead title="Join the group" />
          <div className="note warn">
            This join link isn&apos;t right. Ask the organiser to send it to you
            again.
          </div>
        </>
      ) : (
        <>
          <PageHead
            title={`Join ${group.name}`}
            sub="Ladies only. The organiser approves everyone before they can use the app."
          />
          <form
            action={requestToJoin}
            className="stack"
            style={{ marginTop: 8 }}
          >
            {problem === "2" ? (
              <div className="note warn" role="alert">
                Something went wrong sending that. Please try again, or message
                the organiser directly.
              </div>
            ) : problem ? (
              <div className="note warn" role="alert">
                Please enter your name and a WhatsApp number with at least 8
                digits.
              </div>
            ) : null}
            {slug ? (
              <input type="hidden" name="slug" value={slug} />
            ) : (
              <>
                <input type="hidden" name="code" value={code} />
                <input type="hidden" name="g" value={g} />
              </>
            )}
            <div className="hp" aria-hidden="true">
              <label htmlFor="website">Leave this empty</label>
              <input
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                maxLength={80}
                defaultValue={name}
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Your WhatsApp number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07… or +44…"
                required
                maxLength={30}
                defaultValue={phone}
              />
            </div>
            <SubmitButton
              className="btn btn-primary btn-block"
              style={{ minHeight: 52 }}
              pendingText="Sending…"
            >
              Send request
            </SubmitButton>
            <p className="small muted">
              Your name and number are only used to run the group.{" "}
              <a href="/privacy">How we look after your details</a>.
            </p>
          </form>
        </>
      )}
    </main>
  );
}
