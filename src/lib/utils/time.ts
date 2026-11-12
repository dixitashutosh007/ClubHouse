/**
 * Junto time handling. All ride dates and times are India Standard Time
 * (UTC+05:30, no daylight saving), regardless of the device or server
 * time zone.
 *
 * - Dates are `YYYY-MM-DD` strings in IST.
 * - Times are ISO strings with an explicit offset: `2026-10-10T08:30:00+05:30`.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hhmmFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const displayTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIME_ZONE, weekday: 'short' });
const dayLabelFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  month: 'short',
  day: 'numeric',
});

/** The IST calendar date (`YYYY-MM-DD`) of an instant; defaults to now */
export function istDateString(date: Date = new Date()): string {
  return isoDateFormatter.format(date);
}

/** Adds whole days to a `YYYY-MM-DD` date */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Combines an IST date and `HH:mm` into an ISO string with the IST offset */
export function istDateTime(dateStr: string, hhmm: string): string {
  return `${dateStr}T${hhmm}:00${IST_OFFSET}`;
}

/** `HH:mm` (24-hour) in IST, e.g. for time inputs */
export function istTimeHHMM(iso: string): string {
  return hhmmFormatter.format(new Date(iso));
}

/** Human-readable IST time, e.g. "08:30 am" */
export function formatIstTime(iso: string): string {
  return displayTimeFormatter.format(new Date(iso));
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** Human-readable IST date and time, e.g. "12 Nov, 8:30 am" */
export function formatIstDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

const dayFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** A `YYYY-MM-DD` IST date for people, e.g. "Thu, 13 Nov" */
export function formatIstDay(dateStr: string): string {
  return dayFormatter.format(new Date(`${dateStr}T12:00:00+05:30`));
}

/** The IST date part of an ISO date-time */
export function istDateOf(iso: string): string {
  return istDateString(new Date(iso));
}

/** "Today", "Tomorrow" or the date itself for a `YYYY-MM-DD` date */
export function relativeDayLabel(dateStr: string, now: Date = new Date()): string {
  const today = istDateString(now);
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  return dateStr;
}

export interface DayOption {
  dateStr: string;
  weekday: string;
  label: string;
}

/** Day picker options from today through `count` days ahead, in IST */
export function upcomingIstDays(count: number, now: Date = new Date()): DayOption[] {
  const today = istDateString(now);
  const days: DayOption[] = [];
  for (let i = 0; i <= count; i++) {
    const dateStr = addDays(today, i);
    const noon = new Date(`${dateStr}T12:00:00${IST_OFFSET}`);
    days.push({
      dateStr,
      weekday: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekdayFormatter.format(noon),
      label: dayLabelFormatter.format(noon),
    });
  }
  return days;
}

/** Minutes between departure-time choices in the ride forms */
export const TIME_STEP_MINUTES = 5;

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHHMM(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** `HH:mm` plus some minutes, kept within the day's last time choice (23:55) */
export function addMinutesHHMM(hhmm: string, minutes: number): string {
  const lastSlot = 24 * 60 - TIME_STEP_MINUTES;
  return minutesToHHMM(Math.min(Math.max(hhmmToMinutes(hhmm) + minutes, 0), lastSlot));
}

/** Every `HH:mm` of the day, `step` minutes apart, from 00:00 */
export function timeSlots(step: number = TIME_STEP_MINUTES): string[] {
  const slots: string[] = [];
  for (let t = 0; t < 24 * 60; t += step) slots.push(minutesToHHMM(t));
  return slots;
}

/** `HH:mm` as a 12-hour label, e.g. "08:05" -> "8:05 AM" */
export function formatHHMM12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
