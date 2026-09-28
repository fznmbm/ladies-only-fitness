import Link from "next/link";
import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { APP_FULL_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Your privacy" };

/** A plain-English privacy notice, linked from the join form and the ladies' page. */
export default function PrivacyPage() {
  const name = APP_FULL_NAME;
  return (
    <main className="shell">
      <PageHead title="Your privacy" sub={name} />
      <div className="stack">
        <div className="card stack">
          <h2 className="section-title" style={{ margin: 0 }}>What we keep</h2>
          <p>
            Your name, your WhatsApp number, which group you&apos;re in, the
            sessions you come to or say you&apos;re coming to, the plans you pay
            for, and photos of bank transfer receipts you send.
          </p>
        </div>
        <div className="card stack">
          <h2 className="section-title" style={{ margin: 0 }}>Why</h2>
          <p>
            Only to run the group: to know who&apos;s coming, keep track of
            plans and payments, and message you about sessions. We never sell
            or share your details, and we don&apos;t use them for advertising.
          </p>
        </div>
        <div className="card stack">
          <h2 className="section-title" style={{ margin: 0 }}>Who can see it</h2>
          <p>
            Only the organiser, and helpers at the door who can see names and
            who&apos;s been marked here. Other members never see your details
            or payments.
          </p>
        </div>
        <div className="card stack">
          <h2 className="section-title" style={{ margin: 0 }}>How long</h2>
          <p>
            Receipt photos are deleted automatically 6 months after they&apos;re
            sent. Your other details are kept while you&apos;re a member. Ask
            the organiser any time and she&apos;ll delete everything about you.
          </p>
        </div>
        <div className="card stack">
          <h2 className="section-title" style={{ margin: 0 }}>Your rights</h2>
          <p>
            You can ask to see, correct or delete your details at any time.
            Message the organiser on WhatsApp. If you&apos;re not happy with
            the answer, you can contact the Information Commissioner&apos;s
            Office at ico.org.uk.
          </p>
        </div>
        <p className="small muted">
          <Link href="/me">Back to the app</Link>
        </p>
      </div>
    </main>
  );
}
