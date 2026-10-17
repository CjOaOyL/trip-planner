import type { Day } from '../types';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LONG_TO_SHORT: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
  january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', june: 'Jun',
  july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec',
};

const DATE_WORD = /\b(sun|mon|tue|wed|thu|fri|sat|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/** Format an ISO date plus an offset in days as "Thu, Nov 5". Parses in local time so the day never shifts. */
export function formatTripDate(startDate: string, offsetDays: number): string {
  const d = new Date(startDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + offsetDays);
  return `${DOW_SHORT[d.getDay()]}, ${MON_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/**
 * The calendar date to show for a day, when it is known.
 * Prefers the date written into the day's label ("Day 3 — Friday, Nov 6 ★ Concert #2" → "Fri, Nov 6"),
 * which is what seeded and custom itineraries carry; falls back to the trip start date plus the day index.
 * Returns '' when neither source gives a date.
 */
export function dayDateText(day: Day, index: number, startDate?: string): string {
  const afterDash = day.label.split(/\s[—–-]\s/)[1];
  if (afterDash) {
    const text = afterDash.split('★')[0].trim();
    if (DATE_WORD.test(text)) {
      return text.replace(/[A-Za-z]+/g, (w) => LONG_TO_SHORT[w.toLowerCase()] ?? w);
    }
  }
  return startDate ? formatTripDate(startDate, index) : '';
}
