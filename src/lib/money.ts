export function pounds(pence: number): string {
  const v = pence / 100;
  return "£" + (Number.isInteger(v) ? String(v) : v.toFixed(2));
}

export function toPence(input: string): number {
  const n = Number.parseFloat(input.replace(/[£,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
