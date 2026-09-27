"use client";

import { useEffect } from "react";

// Shown instead of a blank screen when something goes wrong on the ladies' pages,
// the join form or the sign-in page.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell">
      <div className="stack" style={{ paddingTop: 48 }}>
        <h1 className="title">Sorry, something went wrong</h1>
        <p className="subtitle">
          Please try again. If it keeps happening, message the organiser on
          WhatsApp.
        </p>
        {error.digest ? (
          <p className="small muted">Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
