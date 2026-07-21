import { CalendarEvent, ScheduleAssignment, WorkRequest } from '@/types';

/**
 * One entry in a day's ordered schedule: a work request (grouped across the
 * crews sharing it that day) or a calendar event. Work requests and events
 * share the same intra-day ordering space (priorityOrder), so a single sorted
 * list drives the day cells, the day sidebar, and drag-reordering.
 */
export type DayItem =
  | { kind: 'request'; key: string; card: WorkRequest; group: ScheduleAssignment[] }
  | { kind: 'event'; key: string; event: CalendarEvent };

/** The item's intra-day sort key. */
function orderOf(item: DayItem): number {
  return item.kind === 'request' ? item.card.priorityOrder : item.event.priorityOrder;
}

/** Stable tiebreak so equal orders don't jitter between renders. */
function titleOf(item: DayItem): string {
  return item.kind === 'request' ? item.card.title : item.event.title;
}

/**
 * Build a day's ordered schedule: one entry per work request (its assignments
 * for the day grouped, mirroring the calendar's one-chip-per-request rule)
 * plus that day's events, sorted by priorityOrder.
 */
export function buildDayItems(
  dayAssignments: ScheduleAssignment[],
  workRequests: WorkRequest[],
  dayEvents: CalendarEvent[]
): DayItem[] {
  const items: DayItem[] = [];
  for (const a of dayAssignments) {
    const existing = items.find(
      (item) => item.kind === 'request' && item.card.id === a.workRequestId
    );
    if (existing && existing.kind === 'request') {
      existing.group.push(a);
      continue;
    }
    const card = workRequests.find((c) => c.id === a.workRequestId);
    if (card) {
      items.push({ kind: 'request', key: `request:${card.id}`, card, group: [a] });
    }
  }
  for (const event of dayEvents) {
    items.push({ kind: 'event', key: `event:${event.id}`, event });
  }
  return items.sort(
    (a, b) => orderOf(a) - orderOf(b) || titleOf(a).localeCompare(titleOf(b))
  );
}
