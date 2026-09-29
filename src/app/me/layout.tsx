import type { Metadata } from "next";
import { APP_FULL_NAME } from "@/lib/config";
import { ThemeToggle } from "@/components/ThemeToggle";

// Each lady gets her own manifest, so the installed app reopens signed in.
export const metadata: Metadata = {
  manifest: "/me/manifest.webmanifest",
};

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <div className="brand-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/livefit-mark.png" alt="" width={22} height={30} />
        <span className="grow">{APP_FULL_NAME}</span>
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
