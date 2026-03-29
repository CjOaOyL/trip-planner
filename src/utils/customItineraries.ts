/**
 * Create alternative itineraries (fork / clone).
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
