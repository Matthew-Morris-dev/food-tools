// Dates are local calendar days as YYYY-MM-DD strings

export function toDateString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = () => toDateString(new Date());

function parse(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, days: number) {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function dayLabel(date: string) {
  const t = today();
  if (date === t) return 'Today';
  if (date === addDays(t, -1)) return 'Yesterday';
  if (date === addDays(t, 1)) return 'Tomorrow';
  return parse(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
