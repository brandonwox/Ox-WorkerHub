import { format } from 'date-fns';

import { ScheduleAssignment } from '@/types';

/**
 * The day to show for each scheduled work request: its next assignment on or
 * after today, else (every assignment in the past) its most recent one. Keyed
 * by work request id — cards with no assignment are absent. One rule for the
 * web Work Requests list and the phone list.
 */
export function scheduledDateByCard(
  assignments: ScheduleAssignment[],
  today: string = format(new Date(), 'yyyy-MM-dd')
): Map<string, string> {
  const byCard = new Map<string, string[]>();
  for (const a of assignments) {
    const dates = byCard.get(a.workRequestId) ?? [];
    dates.push(a.date);
    byCard.set(a.workRequestId, dates);
  }
  const map = new Map<string, string>();
  for (const [cardId, dates] of byCard) {
    dates.sort();
    map.set(cardId, dates.find((d) => d >= today) ?? dates[dates.length - 1]);
  }
  return map;
}
