import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";
import { setRsvp, clearRsvp } from "@/app/me/actions";

type Props = {
  sessionId: string;
  state: "yes" | "no" | "none";
};

/** Tapping the active button again clears it, back to undecided. */
export function RsvpButtons({ sessionId, state }: Props) {
  return (
    <div className="cluster" style={{ gap: 10, flexWrap: "nowrap" }}>
      <form action={state === "yes" ? clearRsvp : setRsvp} style={{ flex: 1 }}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="coming" value="true" />
        <SubmitButton
          pendingText="Saving…"
          className={
            state === "yes"
              ? "btn btn-primary btn-block"
              : "btn btn-outline btn-block"
          }
          aria-pressed={state === "yes"}
        >
          {state === "yes" ? <Icon name="check" size={18} /> : null}
          I&apos;m coming
        </SubmitButton>
      </form>
      <form action={state === "no" ? clearRsvp : setRsvp} style={{ flex: 1 }}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="coming" value="false" />
        <SubmitButton
          pendingText="Saving…"
          className={
            state === "no" ? "btn btn-block" : "btn btn-outline btn-block"
          }
          style={
            state === "no"
              ? {
                  background: "var(--brick-tint)",
                  color: "var(--brick)",
                  border: "1.5px solid transparent",
                }
              : undefined
          }
          aria-pressed={state === "no"}
        >
          {state === "no" ? <Icon name="x" size={18} /> : null}
          Can&apos;t make it
        </SubmitButton>
      </form>
    </div>
  );
}
