import { requestToJoin } from "./actions";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    sent?: string;
    problem?: string;
    name?: string;
    phone?: string;
  }>;
}) {
  const {
    code = "",
    sent,
    problem,
    name = "",
    phone = "",
  } = await searchParams;
  const needed = process.env.JOIN_CODE;
  const allowed = !needed || code === needed;

  return (
    <main className="shell">
      {sent ? (
        <>
          <PageHead title="Request sent" />
          <div className="note">
            Thank you. The organiser will check your request and send your
            personal link on WhatsApp.
          </div>
        </>
      ) : !allowed ? (
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
            title="Join the group"
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
            <input type="hidden" name="code" value={code} />
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
                placeholder="07… or +94…"
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
          </form>
        </>
      )}
    </main>
  );
}
