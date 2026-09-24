import type { Metadata } from "next";

// Each lady gets her own manifest, so the installed app reopens signed in.
export const metadata: Metadata = {
  manifest: "/me/manifest.webmanifest",
};

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>;
}
