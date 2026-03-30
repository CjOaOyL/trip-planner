/**
 * Create alternative itineraries (fork / clone) + blank itinerary creation.
 *
 * Fork an existing itinerary, give it a new id + name, and persist it
 * in localStorage so it shows up alongside the bundled ones.
 *
 *   Key:  `custom-itineraries:${tripId}`
 *   Value: Itinerary[]  (full itinerary objects)
 */
import type { Itinerary, Day, Leg, Segment } from '../types';

function key(tripId: string) {
  return `custom-itineraries:${tripId}`;
}

/** Read all user-created itineraries for a trip. */
export function getCustomItineraries(tripId: string): Itinerary[] {
  try {
    const raw = localStorage.getItem(key(tripId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save the full list of custom itineraries. */
function saveAll(tripId: string, itineraries: Itinerary[]) {
  localStorage.setItem(key(tripId), JSON.stringify(itineraries));
}

/** Add a new custom itinerary. */
export function addCustomItinerary(tripId: string, it: Itinerary) {
  const all = getCustomItineraries(tripId);
  all.push(it);
  saveAll(tripId, all);
}

/** Delete a custom itinerary by id. */
export function deleteCustomItinerary(tripId: string, itineraryId: string) {
  const all = getCustomItineraries(tripId).filter((it) => it.id !== itineraryId);
  saveAll(tripId, all);
}

/** Update (replace) a custom itinerary. */
export function updateCustomItinerary(tripId: string, updated: Itinerary) {
  const all = getCustomItineraries(tripId).map((it) =>
    it.id === updated.id ? updated : it,
  );
  saveAll(tripId, all);
}

/** Check if an itinerary id is custom (user-created). */
export function isCustomItinerary(tripId: string, itineraryId: string): boolean {
  return getCustomItineraries(tripId).some((it) => it.id === itineraryId);
}

/* ─── Deep-clone helpers ───────────────────────────────────────────────────── */

function cloneSegment(s: Segment): Segment {
  return { ...s };
}

function cloneLeg(l: Leg): Leg {
  return {
    ...l,
    chargingStops: l.chargingStops ? l.chargingStops.map((c) => ({ ...c })) : undefined,
  };
}

function cloneDay(d: Day, newIdPrefix: string): Day {
  return {
    ...d,
    id: `${newIdPrefix}-${d.id}`,
    legs: d.legs.map(cloneLeg),
    segments: d.segments.map(cloneSegment),
  };
}

/**
 * Fork an itinerary: deep-clone with a new id and name.
 * Returns the new Itinerary (does NOT persist — caller should call addCustomItinerary).
 */
export function forkItinerary(source: Itinerary, suffix?: string): Itinerary {
  const timestamp = Date.now().toString(36);
  const newId = `custom-${timestamp}`;
  const label = suffix ?? 'Alternative';

  return {
    ...source,
    id: newId,
    name: `${source.name} — ${label}`,
    tagline: `${source.tagline} (${label.toLowerCase()})`,
    archived: false,
    days: source.days.map((d) => cloneDay(d, newId)),
    highlights: [...source.highlights],
  };
}

/**
 * Create a blank itinerary with a given number of days.
 * Returns an unsaved Itinerary — caller should call addCustomItinerary.
 */
export function createBlankItinerary(opts: {
  name: string;
  numDays: number;
  startDate: string;       // ISO date e.g. "2026-04-11"
  originPlaceId: string;
}): Itinerary {
  const timestamp = Date.now().toString(36);
  const newId = `custom-${timestamp}`;
  const start = new Date(opts.startDate + 'T00:00:00');
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const days: Day[] = [];
  for (let i = 0; i < opts.numDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const label = `Day ${i + 1} — ${DOW[date.getDay()]}, ${MON[date.getMonth()]} ${date.getDate()}`;
    days.push({
      id: `${newId}-day${i + 1}`,
      label,
      theme: i === 0 ? 'Departure' : i === opts.numDays - 1 ? 'Return Home' : 'TBD',
      legs: [],
      segments: [],
      overnightPlaceId: opts.originPlaceId,
    });
  }

  return {
    id: newId,
    name: opts.name || 'New Itinerary',
    tagline: 'Custom itinerary',
    vibe: '',
    highlights: [],
    skiDays: 0,
    includesMontreal: false,
    includesPortland: false,
    totalMiles: 0,
    days,
  };
}
