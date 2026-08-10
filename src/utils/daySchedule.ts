import { ScheduleAssignment, WorkRequest } from '@/types';

/**
 * One entry in a day's ordered schedule: a work request, grouped across the
 * crews sharing it that day. Ordered by priorityOrder, so a single sorted
 * list drives the day cells, the day sidebar, and drag-reordering.
 */
export interface DayItem {
  key: string;
  card: WorkRequest;
  group: ScheduleAssignment[];
}

/**
 * Build a day's ordered schedule: one entry per work request (its assignments
 * for the day grouped, mirroring the calendar's one-chip-per-request rule),
 * sorted by priorityOrder with a stable title tiebreak.
 */
export function buildDayItems(
  dayAssignments: ScheduleAssignment[],
  workRequests: WorkRequest[]
): DayItem[] {
  const items: DayItem[] = [];
  for (const a of dayAssignments) {
    const existing = items.find((item) => item.card.id === a.workRequestId);
    if (existing) {
      existing.group.push(a);
      continue;
    }
    const card = workRequests.find((c) => c.id === a.workRequestId);
    if (card) {
      items.push({ key: `request:${card.id}`, card, group: [a] });
    }
  }
  return items.sort(
    (a, b) =>
      a.card.priorityOrder - b.card.priorityOrder ||
      a.card.title.localeCompare(b.card.title)
  );
}
