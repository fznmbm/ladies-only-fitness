import type { ReactNode } from "react";
import { groupName } from "@/lib/config";

export { groupName };

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="group-name brand-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/livefit-mark.png" alt="" width={16} height={22} />
        {groupName()}
      </div>
      <h1 className="title">{title}</h1>
      {sub ? <p className="subtitle">{sub}</p> : null}
      {children}
    </header>
  );
}
