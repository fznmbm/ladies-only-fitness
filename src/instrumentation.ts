import type { Instrumentation } from "next";

let lastAlert = 0;

/**
 * When something goes wrong on the live site, sends a short alert to your phone.
 * Set ALERT_WEBHOOK_URL in Vercel to an ntfy.sh address (free: install the ntfy
 * app and subscribe to the same private topic name). Leave it empty for no alerts.
 * At most one alert a minute, and never any personal details.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const now = Date.now();
  if (now - lastAlert < 60_000) return;
  lastAlert = now;

  const e = err as Error & { digest?: string };
  // A lady's personal link must never end up in an alert.
  const path = request.path.replace(/\/m\/[^/?#]+/, "/m/…").split("?")[0];
  try {
    await fetch(url, {
      method: "POST",
      headers: { Title: "LiveFit: something went wrong", Tags: "warning" },
      body: `${e.message || "Error"}\n${request.method} ${path}\nReference: ${e.digest ?? "none"} (${context.routeType})`,
    });
  } catch {
    // Never let the alert itself cause a problem.
  }
};
