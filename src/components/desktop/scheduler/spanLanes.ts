import { useState } from 'react';

/**
 * Shared multi-day bar geometry for the month calendars (the crew calendar
 * and the Work Requests calendar both draw stretched requests as ONE bar
 * across their week rows): slicing spans per week, greedy lane packing, and
 * the live column rects the bars position against.
 */

/** Anything covering a contiguous yyyy-MM-dd range (start ≤ end). */
export interface DateSpan {
  start: string;
  end: string;
}

/** One week-row slice of a multi-day span, with its allocated lane. */
export interface LaneSegment<S extends DateSpan> {
  span: S;
  /**
   * Columns the slice covers: indexes into the row's `dateStrs` (0 Sun … 6
   * Sat on a full week, 0 Mon … 4 Fri with weekends hidden).
   */
  startCol: number;
  endCol: number;
  /** The span continues past this week's edge(s). */
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
}

// Bars overlay the week row at fixed lane slots, and every covered cell
// reserves the same vertical space so its single-day chips start below them.
// Two text lines (title + job name), same as a single-day chip.
export const BAR_H = 34;
/** One lane's slot (bar + gap). */
export const LANE_H = BAR_H + 3;
/** Distance from the week row's top to lane 0: cell padding + day number line. */
export const BAR_TOP = 25;

/** The weekday columns (0 Sun … 6 Sat) a month grid shows: all, or Mon–Fri. */
export function visibleWeekdayCols(hideWeekends: boolean): number[] {
  return hideWeekends ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
}

/**
 * The first and last real day of a week row (nulls pad the month's edges).
 * Both null for a row with no days (never happens for a month grid).
 */
export function weekBounds(dateStrs: (string | null)[]): {
  weekStart: string | null;
  weekEnd: string | null;
} {
  const firstCol = dateStrs.findIndex((d) => d !== null);
  if (firstCol === -1) return { weekStart: null, weekEnd: null };
  const lastCol =
    dateStrs.length - 1 - [...dateStrs].reverse().findIndex((d) => d !== null);
  return { weekStart: dateStrs[firstCol], weekEnd: dateStrs[lastCol] };
}

/**
 * This week row's slice of every intersecting span, then greedy lane packing
 * (earlier starts first, longer spans first among equals, `titleOf` as the
 * stable tiebreak) so overlapping bars stack instead of colliding.
 *
 * `dateStrs` is the row's columns in order (nulls pad the month's edges; a
 * Mon–Fri row simply has five). Segment columns index into it, so bars line
 * up with whatever days the row shows: a span's weekend days, with weekends
 * hidden, are clipped off and the bar reads as continuing past the row's
 * edge — and a span sitting entirely on hidden days yields no segment.
 */
export function packWeekSegments<S extends DateSpan>(
  spans: S[],
  dateStrs: (string | null)[],
  titleOf: (span: S) => string
): LaneSegment<S>[] {
  const segments: LaneSegment<S>[] = [];
  const { weekStart, weekEnd } = weekBounds(dateStrs);
  if (!weekStart || !weekEnd) return segments;
  for (const span of spans) {
    if (span.end < weekStart || span.start > weekEnd) continue;
    const segStart = span.start < weekStart ? weekStart : span.start;
    const segEnd = span.end > weekEnd ? weekEnd : span.end;
    // The row's shown days are consecutive calendar days (hidden weekends
    // sit at its edges, never inside), so both clipped ends are columns.
    const startCol = dateStrs.indexOf(segStart);
    const endCol = dateStrs.indexOf(segEnd);
    if (startCol === -1 || endCol === -1) continue;
    segments.push({
      span,
      startCol,
      endCol,
      continuesBefore: span.start < segStart,
      continuesAfter: span.end > segEnd,
      lane: 0,
    });
  }
  segments.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - a.endCol ||
      titleOf(a.span).localeCompare(titleOf(b.span))
  );
  const laneEnds: number[] = []; // last occupied column per lane
  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.endCol);
    } else {
      laneEnds[lane] = seg.endCol;
    }
    seg.lane = lane;
  }
  return segments;
}

/** Vertical bar slots a cell must reserve (deepest lane covering it + 1). */
export function lanesOver<S extends DateSpan>(
  segments: LaneSegment<S>[],
  col: number
): number {
  let lanes = 0;
  for (const seg of segments) {
    if (col >= seg.startCol && col <= seg.endCol) {
      lanes = Math.max(lanes, seg.lane + 1);
    }
  }
  return lanes;
}

export type ColRect = { x: number; w: number } | null;

/**
 * Each weekday column's measured x/width within its week row. Columns are
 * flex-sized (the hovered one widens), so bar overlays position off these
 * live rects instead of fixed sevenths. Sub-pixel jitter is ignored so a
 * layout pass can't re-render in a loop.
 */
export function useColRects(): [
  ColRect[],
  (col: number, x: number, w: number) => void,
] {
  const [colRects, setColRects] = useState<ColRect[]>([]);
  const setColRect = (col: number, x: number, w: number) =>
    setColRects((prev) => {
      const cur = prev[col];
      if (cur && Math.abs(cur.x - x) < 0.5 && Math.abs(cur.w - w) < 0.5) {
        return prev;
      }
      const next = [...prev];
      next[col] = { x, w };
      return next;
    });
  return [colRects, setColRect];
}
