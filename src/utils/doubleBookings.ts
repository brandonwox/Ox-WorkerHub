import { Crew, DailyCrew, WorkRequest, ScheduleAssignment, Worker } from '@/types';

/** One working crew that claims a double-booked installer on the conflict day. */
export interface DoubleBookingCrewRef {
  crewId: string;
  crewName: string;
  /** True when this is a Daily Crew (one-day override) rather than a permanent one. */
  isDaily: boolean;
  /** The work requests that crew has scheduled that day. */
  workRequests: { id: string; title: string }[];
}

/**
 * An installer who is claimed by two or more crews that both have work on the
 * same day — i.e. expected in more than one place at once.
 */
export interface DoubleBooking {
  /** Stable key: `${installerId}:${date}`. */
  id: string;
  installerId: string;
  installerName: string;
  /** yyyy-MM-dd of the conflict. */
  date: string;
  /** The working crews that all claim this installer that day (always ≥ 2). */
  crews: DoubleBookingCrewRef[];
}

interface Input {
  crews: Crew[];
  dailyCrews: DailyCrew[];
  assignments: ScheduleAssignment[];
  workRequests: WorkRequest[];
  workers: Worker[];
}

/**
 * Find every installer who is double-booked: expected in more than one place
 * at once AFTER the daily-over-permanent resolution is applied. A working
 * Daily Crew silently overrides the member's permanent crew (that's the
 * feature, not a conflict) — so the only remaining conflict is an installer
 * in TWO OR MORE daily crews that each have work the same day (they'd see
 * the union of that work). Pure/derived — safe to recompute from store state
 * whenever the schedule changes.
 */
export function detectDoubleBookings({
  crews,
  dailyCrews,
  assignments,
  workRequests,
  workers,
}: Input): DoubleBooking[] {
  const crewById = new Map(crews.map((c) => [c.id, c]));
  const dailyById = new Map(dailyCrews.map((d) => [d.id, d]));
  const workRequestById = new Map(workRequests.map((j) => [j.id, j]));
  const workerById = new Map(workers.map((w) => [w.id, w]));

  // date -> crewId -> the crew's working reference (roster + work requests that day).
  const byDate = new Map<string, Map<string, DoubleBookingCrewRef>>();

  for (const a of assignments) {
    const crew = crewById.get(a.crewId) ?? dailyById.get(a.crewId);
    if (!crew) continue;
    let crewsForDate = byDate.get(a.date);
    if (!crewsForDate) {
      crewsForDate = new Map();
      byDate.set(a.date, crewsForDate);
    }
    let ref = crewsForDate.get(a.crewId);
    if (!ref) {
      ref = {
        crewId: crew.id,
        crewName: crew.name,
        isDaily: dailyById.has(a.crewId),
        workRequests: [],
      };
      crewsForDate.set(a.crewId, ref);
    }
    const card = workRequestById.get(a.workRequestId);
    if (card && !ref.workRequests.some((jc) => jc.id === card.id)) {
      ref.workRequests.push({ id: card.id, title: card.title });
    }
  }

  const result: DoubleBooking[] = [];

  for (const [date, crewsForDate] of byDate) {
    const workingCrews = [...crewsForDate.values()];
    if (workingCrews.length < 2) continue; // a single crew can't self-conflict

    // installerId -> the working crews that list them that day.
    const installerCrews = new Map<string, DoubleBookingCrewRef[]>();
    for (const ref of workingCrews) {
      const crew = crewById.get(ref.crewId) ?? dailyById.get(ref.crewId);
      if (!crew) continue;
      for (const installerId of crew.installerIds) {
        const list = installerCrews.get(installerId) ?? [];
        list.push(ref);
        installerCrews.set(installerId, list);
      }
    }

    for (const [installerId, refs] of installerCrews) {
      // Resolve the daily-over-permanent rule first: with any working daily
      // crew in the mix, the permanent crew's claim doesn't count that day.
      const dailies = refs.filter((r) => r.isDaily);
      const resolved = dailies.length > 0 ? dailies : refs;
      if (resolved.length < 2) continue;
      const worker = workerById.get(installerId);
      result.push({
        id: `${installerId}:${date}`,
        installerId,
        installerName: worker?.name ?? 'Unknown installer',
        date,
        crews: resolved,
      });
    }
  }

  // Stable order: soonest conflict first, then by installer name.
  result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.installerName.localeCompare(b.installerName)
  );
  return result;
}
