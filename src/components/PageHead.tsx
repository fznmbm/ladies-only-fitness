import type { ReactNode } from "react";

export function groupName() {
  return process.env.NEXT_PUBLIC_GROUP_NAME || "Ladies Fitness";
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="group-name">{groupName()}</div>
      <h1 className="title">{title}</h1>
      {sub ? <p className="subtitle">{sub}</p> : null}
      {children}
    </header>
  );
}
