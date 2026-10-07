// Dates are calendar days as YYYY-MM-DD strings, handled in UTC so there are no DST surprises

const parse = (date: string) => new Date(`${date}T00:00:00Z`);
const format = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);

// ISO weekday: 1 = Monday ... 7 = Sunday
export const isoWeekday = (date: string) => parse(date).getUTCDay() || 7;

export function eachDay(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// The Monday of the week containing a date (weeks start on Monday)
export const weekStart = (date: string) => addDays(date, 1 - isoWeekday(date));

export const weekDates = (date: string) => eachDay(weekStart(date), addDays(weekStart(date), 6));
