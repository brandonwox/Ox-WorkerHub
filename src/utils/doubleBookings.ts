import { Crew, DailyCrew, Jobcard, ScheduleAssignment, Worker } from '@/types';

/** One working crew that claims a double-booked installer on the conflict day. */
export interface DoubleBookingCrewRef {
  crewId: string;
  crewName: string;
  /** True when this is a Daily Crew (one-day override) rather than a permanent one. */
  isDaily: boolean;
  /** The jobcards that crew has scheduled that day. */
  jobcards: { id: string; title: string }[];
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
  jobcards: Jobcard[];
  workers: Worker[];
}

/**
 * Find every installer who is double-booked: a member of two or more crews that
 * each have a jobcard scheduled on the same day. A Daily Crew counts as its own
 * crew, so an installer pulled onto a Daily Crew while their permanent crew is
 * still working that day is a conflict. Pure/derived — safe to recompute from
 * store state whenever the schedule changes.
 */
export function detectDoubleBookings({
  crews,
  dailyCrews,
  assignments,
  jobcards,
  workers,
}: Input): DoubleBooking[] {
  const crewById = new Map(crews.map((c) => [c.id, c]));
  const dailyById = new Map(dailyCrews.map((d) => [d.id, d]));
  const jobcardById = new Map(jobcards.map((j) => [j.id, j]));
  const workerById = new Map(workers.map((w) => [w.id, w]));

  // date -> crewId -> the crew's working reference (roster + jobcards that day).
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
        jobcards: [],
      };
      crewsForDate.set(a.crewId, ref);
    }
    const card = jobcardById.get(a.jobcardId);
    if (card && !ref.jobcards.some((jc) => jc.id === card.id)) {
      ref.jobcards.push({ id: card.id, title: card.title });
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
      if (refs.length < 2) continue;
      const worker = workerById.get(installerId);
      result.push({
        id: `${installerId}:${date}`,
        installerId,
        installerName: worker?.name ?? 'Unknown installer',
        date,
        crews: refs,
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
