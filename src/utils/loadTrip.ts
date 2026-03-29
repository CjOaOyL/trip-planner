import type { Trip, TripMeta, Place, Itinerary } from '../types';

/**
 * Registry of all available trips.
 * To add a new trip: drop its data files into /data/trips/<id>/
 * and add one line here.
 */
export const TRIP_REGISTRY: { id: string; label: string }[] = [
  { id: 'spring-break-2026', label: 'Spring Break 2026' },
];

/**
 * Dynamically imports all data files for a given trip id.
 * Vite resolves these at build time from /data/trips/<id>/.
 */
export async function loadTrip(tripId: string): Promise<Trip> {
  const [meta, placesArray, ...itineraries] = await Promise.all([
    import(`../../data/trips/${tripId}/meta.json`).then((m) => m.default as TripMeta),
    import(`../../data/trips/${tripId}/places.json`).then((m) => m.default as Place[]),
    ...getItineraryIds(tripId).map((iId) =>
      import(`../../data/trips/${tripId}/itineraries/${iId}.json`).then(
        (m) => m.default as Itinerary
      )
    ),
  ]);

  const places: Record<string, Place> = {};
  for (const p of placesArray) {
    places[p.id] = p;
  }

  return { meta, places, itineraries };
}

/**
 * Returns the ordered list of itinerary file names for a trip.
 * We read this from the trip's meta.json itineraryIds field.
 * This function is called before the async load, so we import meta synchronously
 * using a small lookup table. Add new trips here when you add to TRIP_REGISTRY.
 */
function getItineraryIds(tripId: string): string[] {
  const map: Record<string, string[]> = {
    'spring-break-2026': [
      '01-scholars-loop',
      '02-diaspora-journey',
      '03-ski-first',
      '04-long-weekend',
    ],
  };
  return map[tripId] ?? [];
}
