/**
 * Tidies a WhatsApp number into one standard form, e.g. +447700900123, so the
 * same phone typed different ways is recognised as the same number.
 * UK numbers starting with 0 become +44. For any other country, enter the
 * number with its country code, e.g. +94 77 123 4567.
 * Returns null if it can't be a real number.
 * The database does exactly the same when saving (migration 007).
 */
export function normalizePhone(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  d = d.replace(/\D/g, "");
  // "+44 (0)7700…" and "+44 07700…": drop the extra 0 after the UK code.
  if (d.startsWith("440")) d = "44" + d.slice(3);
  if (d.length < 8 || d.length > 15) return null;
  return "+" + d;
}

/** Builds a WhatsApp link with the message already written. */
export function whatsappUrl(phone: string | null, text: string): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `https://wa.me/${n.slice(1)}?text=${encodeURIComponent(text)}`;
}
