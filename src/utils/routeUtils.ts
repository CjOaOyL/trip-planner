import type { Itinerary, Place, Coordinates } from '../types';

export interface RouteStop {
  place: Place;
  dayIndex: number;
  dayLabel: string;
  isOvernight: boolean;
  isChargingStop: boolean;
}

export interface RouteLeg {
  from: Coordinates;
  to: Coordinates;
  dayIndex: number;
  drivingMinutes: number;
  distanceMiles: number;
}

export interface RouteData {
  stops: RouteStop[];           // all unique places in visit order
  legs: RouteLeg[];             // polyline segments
  bounds: [Coordinates, Coordinates]; // SW, NE corners for fitBounds
}

/**
 * Derives all map data from a loaded itinerary + places dictionary.
 * - Stops: deduplicated, ordered by first appearance
 * - Legs: one per driving leg (including charging stop sub-legs)
 * - Bounds: tight bbox around all stops
 */
export function buildRouteData(
  itinerary: Itinerary,
  places: Record<string, Place>
): RouteData {
  const stopMap = new Map<string, RouteStop>();
  const legs: RouteLeg[] = [];

  function addStop(placeId: string, dayIndex: number, dayLabel: string, opts: Partial<RouteStop> = {}) {
    const place = places[placeId];
    if (!place) return;
    if (!stopMap.has(placeId)) {
      stopMap.set(placeId, {
        place,
        dayIndex,
        dayLabel,
        isOvernight: false,
        isChargingStop: false,
        ...opts,
      });
    }
  }

  itinerary.days.forEach((day, dayIndex) => {
    // Add segment places
    day.segments.forEach((seg) => addStop(seg.placeId, dayIndex, day.label));

    // Add overnight
    addStop(day.overnightPlaceId, dayIndex, day.label, { isOvernight: true });
    if (stopMap.has(day.overnightPlaceId)) {
      stopMap.get(day.overnightPlaceId)!.isOvernight = true;
    }

    // Add legs + charging stops
    day.legs.forEach((leg) => {
      const from = places[leg.fromPlaceId];
      const to = places[leg.toPlaceId];

      addStop(leg.fromPlaceId, dayIndex, day.label);
      addStop(leg.toPlaceId, dayIndex, day.label);

      // Build the polyline waypoints: from → [charging stops] → to
      const waypoints: Coordinates[] = [from?.coordinates].filter(Boolean) as Coordinates[];

      if (leg.chargingStops) {
        leg.chargingStops.forEach((cs) => {
          const cp = places[cs.placeId];
          addStop(cs.placeId, dayIndex, day.label, { isChargingStop: true });
          if (stopMap.has(cs.placeId)) stopMap.get(cs.placeId)!.isChargingStop = true;
          if (cp) waypoints.push(cp.coordinates);
        });
      }

      if (to) waypoints.push(to.coordinates);

      // Emit one leg per consecutive pair
      for (let i = 0; i < waypoints.length - 1; i++) {
        legs.push({
          from: waypoints[i],
          to: waypoints[i + 1],
          dayIndex,
          drivingMinutes: leg.drivingMinutes,
          distanceMiles: leg.distanceMiles,
        });
      }
    });
  });

  const stops = Array.from(stopMap.values());
  const coords = stops.map((s) => s.place.coordinates);

  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const bounds: [Coordinates, Coordinates] = [
    [Math.min(...lats) - 0.3, Math.min(...lngs) - 0.3],
    [Math.max(...lats) + 0.3, Math.max(...lngs) + 0.3],
  ];

  return { stops, legs, bounds };
}
