import type { ReactNode } from "react";

/** A page's title. The LiveFit logo sits once at the top of each screen, not here. */
export function PageHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <h1 className="title">{title}</h1>
      {sub ? <p className="subtitle">{sub}</p> : null}
      {children}
    </header>
  );
}
