/**
 * Builds a WhatsApp link with the message already written.
 * UK numbers starting with 0 are converted to +44. For any other country,
 * enter the number with its country code, e.g. +94 77 123 4567.
 */
export function whatsappUrl(phone: string | null, text: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  if (d.length < 8) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
