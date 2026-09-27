"use client";

import { useEffect } from "react";
import Link from "next/link";

// Shown instead of a blank screen when something goes wrong on an organiser page.
// The bottom nav stays, so she can carry on elsewhere.
export default function OrganiserError({
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
    <div className="stack" style={{ paddingTop: 24 }}>
      <h1 className="title">That didn&apos;t work</h1>
      <p className="subtitle">
        Nothing was lost. It may have been a weak signal. Try again, and if it
        keeps happening, go back to Sessions and start from there.
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
      <Link href="/sessions" className="btn btn-outline btn-block">
        Go to Sessions
      </Link>
    </div>
  );
}
