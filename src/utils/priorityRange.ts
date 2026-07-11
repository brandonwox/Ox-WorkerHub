import { addDays, format, isFriday, nextFriday, parseISO } from 'date-fns';

import { Jobcard, PriorityChoice } from '@/types';
import { priorityColor } from '@/utils/priority';

/** Local calendar day as yyyy-MM-dd. */
export function todayYmd(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * This week's Friday (today when it IS Friday). On a weekend the "current
 * week's" Friday has already passed, so it rolls to the upcoming one.
 */
export function upcomingFridayYmd(): string {
  const now = new Date();
  return format(isFriday(now) ? now : nextFriday(now), 'yyyy-MM-dd');
}

/** The Friday after the upcoming one (the "Next week" target). */
export function nextWeekFridayYmd(): string {
  const now = new Date();
  const upcoming = isFriday(now) ? now : nextFriday(now);
  return format(nextFriday(upcoming), 'yyyy-MM-dd');
}

/** The Monday of the week a given Friday (yyyy-MM-dd) belongs to. */
function mondayOfFridaysWeek(fridayYmd: string): string {
  return format(addDays(parseISO(fridayYmd), -4), 'yyyy-MM-dd');
}

/**
 * The start/end window a priority choice resolves to. Week choices span the
 * CHOSEN week — Monday through Friday of the week their target Friday falls
 * in — regardless of which day the choice is made.
 */
export function datesForPriorityChoice(choice: PriorityChoice): {
  startDate: string;
  endDate: string;
} {
  switch (choice) {
    case 'Now':
      return { startDate: todayYmd(), endDate: todayYmd() };
    case 'This week': {
      const friday = upcomingFridayYmd();
      return { startDate: mondayOfFridaysWeek(friday), endDate: friday };
    }
    case 'Next week': {
      const friday = nextWeekFridayYmd();
      return { startDate: mondayOfFridaysWeek(friday), endDate: friday };
    }
    case 'Set dates':
      // Blank on purpose — the Field Super picks both dates manually.
      return { startDate: '', endDate: '' };
  }
}

/** How a card's priority should present, window and escalation resolved. */
export interface EffectivePriority {
  /** Display label — 'Now' when the stored label is Now OR the window is due. */
  label: string;
  /** The stored label, untouched. */
  raw: string;
  startDate?: string;
  endDate?: string;
  /** True when a dated card's end has arrived and the card isn't finished. */
  escalated: boolean;
  /** Badge text: 'Now', the start date ('Jul 15'), or the raw label when undated. */
  short: string;
  /** 'Jul 15 – Jul 19' (single date when start = end); undefined when undated. */
  range?: string;
  color: string;
  /** yyyy-MM-dd sort key — earlier is more urgent. */
  sortKey: string;
}

/**
 * Pseudo-date a label-only (legacy) priority sorts at, so old cards interleave
 * sensibly with date-ranged ones.
 */
function legacySortKey(priority: string): string {
  const day = (offset: number) =>
    format(addDays(new Date(), offset), 'yyyy-MM-dd');
  switch (priority) {
    case 'Now':
    case 'High':
      return day(0);
    case 'Tomorrow':
      return day(1);
    case 'Medium':
      return day(3);
    case 'This Week':
      return upcomingFridayYmd();
    case 'Low':
    case 'Low Priority':
      return day(30);
    default:
      return day(60);
  }
}

/**
 * Resolve how a card's priority presents everywhere: its date window, whether
 * it has escalated to "Now" (end date reached, card not finished), the short
 * badge text, the hover range, color, and sort key. Escalation here is purely
 * visual and instant; the store's escalation sweep persists it (and pings the
 * schedulers) shortly after.
 */
export function effectivePriority(card: Jobcard): EffectivePriority {
  const raw = card.priority;
  const start = card.priorityStartDate;
  const end = card.priorityEndDate;
  const dated = start != null || end != null;
  const escalated =
    raw !== 'Now' &&
    end != null &&
    end <= todayYmd() &&
    card.status !== 'Finished';
  const label = escalated ? 'Now' : raw;

  const fmt = (d: string) => format(parseISO(d), 'MMM d');
  const range = dated
    ? start && end
      ? start === end
        ? fmt(start)
        : `${fmt(start)} – ${fmt(end)}`
      : fmt((start ?? end) as string)
    : undefined;
  const short = label === 'Now' ? 'Now' : start ? fmt(start) : label;

  return {
    label,
    raw,
    startDate: start,
    endDate: end,
    escalated,
    short,
    range,
    color: priorityColor(label),
    sortKey:
      label === 'Now'
        ? todayYmd()
        : dated
          ? ((start ?? end) as string)
          : legacySortKey(raw),
  };
}

/** Sort comparator: most urgent first (earlier effective date). */
export function comparePriority(a: Jobcard, b: Jobcard): number {
  return effectivePriority(a).sortKey.localeCompare(effectivePriority(b).sortKey);
}
