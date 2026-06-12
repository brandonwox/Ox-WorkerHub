import { format, parse, isValid } from 'date-fns';

/** "7:00 AM" style label from an ISO datetime. */
export function formatTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

/** "7:00 AM – 3:30 PM" window label. */
export function formatTimeWindow(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/**
 * Time window label for a job, which may not have one assigned. Returns null
 * when no window is set so callers can render their own "not set" treatment.
 */
export function formatJobWindow(
  startIso?: string,
  endIso?: string
): string | null {
  if (!startIso || !endIso) return null;
  return formatTimeWindow(startIso, endIso);
}

/** "Mon, Jun 8" style label from a yyyy-MM-dd date string. */
export function formatLogDate(dateStr: string): string {
  return format(parse(dateStr, 'yyyy-MM-dd', new Date()), 'EEE, MMM d');
}

/** Decimal hours between two ISO datetimes, rounded to 2 places. */
export function hoursBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round((ms / 3_600_000) * 100) / 100);
}

/** "6h 30m" from decimal hours. */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "$1,234.56" currency label. */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

/** "02:14:09" elapsed label since an ISO datetime. */
export function formatElapsed(startIso: string, now: Date): string {
  const totalSec = Math.max(
    0,
    Math.floor((now.getTime() - new Date(startIso).getTime()) / 1000)
  );
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Parse a user-entered time like "7:30 AM", "7:30am", "07:30", "15:45" onto
 * the given yyyy-MM-dd date. Returns null when the text is not a valid time.
 */
export function parseTimeInput(text: string, dateStr: string): Date | null {
  const trimmed = text.trim().toUpperCase().replace(/\s+/g, ' ');
  const formats = ['h:mm a', 'h:mma', 'H:mm', 'h a', 'ha'];
  const baseDate = parse(dateStr, 'yyyy-MM-dd', new Date());
  for (const fmt of formats) {
    const parsed = parse(trimmed, fmt, baseDate);
    if (isValid(parsed)) return parsed;
  }
  return null;
}
