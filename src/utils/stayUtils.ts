/**
 * Utilities for visualizing consecutive hotel stays in the grid views.
 * A "stay run" is a sequence of consecutive days sharing the same overnightPlaceId.
 */

/** Distinct background colors for up to 7 different hotel stays */
export const STAY_PALETTE = [
  '#fecdd3', // rose-200
  '#bbf7d0', // emerald-200
  '#bae6fd', // sky-200
  '#fef08a', // yellow-200
  '#f5d0fe', // fuchsia-200
  '#99f6e4', // teal-200
  '#fed7aa', // orange-200
];

export interface StayRun {
  placeId: string;
  start: number;   // first day index in this run
  length: number;  // number of consecutive days
  colorIdx: number;
}

/** Compute consecutive runs of the same overnight place */
export function computeStayRuns(overnights: string[]): StayRun[] {
  const runs: StayRun[] = [];
  let i = 0, colorIdx = 0;
  while (i < overnights.length) {
    const placeId = overnights[i];
    let j = i;
    while (j < overnights.length && overnights[j] === placeId) j++;
    runs.push({ placeId, start: i, length: j - i, colorIdx: colorIdx % STAY_PALETTE.length });
    colorIdx++;
    i = j;
  }
  return runs;
}

/** Returns an array mapping each day index to its palette colorIdx */
export function dayColorIdxArray(runs: StayRun[], totalDays: number): number[] {
  const arr = new Array<number>(totalDays).fill(0);
  for (const run of runs) {
    for (let i = run.start; i < run.start + run.length; i++) arr[i] = run.colorIdx;
  }
  return arr;
}

/** True if dayIndex is the last day in its stay run (a stay boundary on the right) */
export function isStayBoundary(runs: StayRun[], di: number): boolean {
  return runs.some((r) => r.start + r.length - 1 === di);
}
