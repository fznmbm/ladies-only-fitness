import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";
import { setRsvp, clearRsvp } from "@/app/me/actions";

type Props = {
  sessionId: string;
  state: "yes" | "no" | "none";
};

/**
 * "I'm coming" / "Can't make it" as one two-part switch.
 * Tapping the chosen side again clears it, back to undecided.
 */
export function RsvpButtons({ sessionId, state }: Props) {
  return (
    <div className="rsvp" role="group" aria-label="Are you coming?">
      <form action={state === "yes" ? clearRsvp : setRsvp}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="coming" value="true" />
        <SubmitButton
          pendingText="Saving…"
          className={state === "yes" ? "rsvp-btn yes on" : "rsvp-btn yes"}
          aria-pressed={state === "yes"}
        >
          {state === "yes" ? <Icon name="check" size={16} /> : null}
          I&apos;m coming
        </SubmitButton>
      </form>
      <form action={state === "no" ? clearRsvp : setRsvp}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="coming" value="false" />
        <SubmitButton
          pendingText="Saving…"
          className={state === "no" ? "rsvp-btn no on" : "rsvp-btn no"}
          aria-pressed={state === "no"}
        >
          {state === "no" ? <Icon name="x" size={16} /> : null}
          Can&apos;t make it
        </SubmitButton>
      </form>
    </div>
  );
}
