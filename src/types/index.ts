// ─── Core geographic types ────────────────────────────────────────────────────

export type Coordinates = [number, number]; // [lat, lng]

export type PlaceType =
  | 'university'
  | 'restaurant'
  | 'attraction'
  | 'hotel'
  | 'ski-resort'
  | 'charging-station'
  | 'neighborhood'
  | 'museum'
  | 'park'
  | 'concert-venue'
  | 'airport'
  | 'beach'
  | 'other';

// ─── Participant types ─────────────────────────────────────────────────────────

export type ParticipantType = 'performer' | 'visitor';

// ─── Event types for group-tour segments ──────────────────────────────────────

export type EventType =
  | 'concert'      // public performance
  | 'rehearsal'    // performers only
  | 'meal'         // group meal (may or may not be open to visitors)
  | 'activity'     // sightseeing, tours, etc.
  | 'free-time'    // unscheduled — visitors can join
  | 'travel'       // transfers, flights
  | 'rest';        // check-in, pool, downtime

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  description: string;
  address: string;
  coordinates: Coordinates;
  googleMapsUrl: string;
  website?: string;
  photos?: string[];        // image URLs (Wikipedia Commons, etc.)
  blackOwned?: boolean;
  tags?: string[];
}

// ─── Trip leg (one drive between two places) ─────────────────────────────────

export interface ChargingStop {
  placeId: string;          // references a Place in places.json
  estimatedChargeMinutes: number;
  supercharger: boolean;
}

export type TravelMode = 'drive' | 'bus' | 'flight' | 'train' | 'walk' | 'boat';

export interface Leg {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  distanceMiles: number;
  drivingMinutes: number;
  travelMode?: TravelMode;   // defaults to 'drive' if absent
  notes?: string;
  chargingStops?: ChargingStop[];
}

// ─── Time slots for the overview grid ────────────────────────────────────────

export type TimeSlot =
  | 'travel'     // departures, arrivals, charging stops
  | 'breakfast'  // 7–10 AM eating
  | 'morning'    // 9 AM–noon activities
  | 'lunch'      // 11 AM–2 PM eating
  | 'afternoon'  // 1–5 PM activities
  | 'dinner'     // 5–8 PM eating
  | 'evening';   // after 7 PM

// ─── A single time block within a day ─────────────────────────────────────────

export interface Segment {
  time: string;             // e.g. "9:00 AM"
  placeId: string;
  activity: string;         // e.g. "Campus tour + Admissions info session"
  durationMinutes: number;
  notes?: string;
  costEstimate?: number;    // estimated cost in USD for the group
  // ── Group-tour fields ──────────────────────────────────────────────────────
  fixed?: boolean;          // true = cannot be moved; core event on a group tour
  eventType?: EventType;    // visual badge + filtering
  openTo?: ParticipantType[]; // which participant types can attend; omit = all
  ticketed?: boolean;       // visitors may need to buy a ticket separately
}

// ─── One day in an itinerary ──────────────────────────────────────────────────

export interface Day {
  id: string;
  label: string;            // e.g. "Day 1 — Saturday, Apr 12"
  theme: string;            // e.g. "Drive + Yale"
  legs: Leg[];
  segments: Segment[];
  overnightPlaceId: string;
  notes?: string;
  lodgingCost?: number;     // estimated overnight cost in USD
}

// ─── One itinerary (a sequence of days) ───────────────────────────────────────

export interface Itinerary {
  id: string;
  name: string;
  tagline: string;
  vibe: string;             // e.g. "Culture-heavy, 2 ski days, no rush"
  highlights: string[];
  skiDays: number;
  includesMontreal: boolean;
  includesPortland: boolean;
  totalMiles: number;
  archived?: boolean;       // hidden from main list; shown in collapsed section
  days: Day[];
}

// ─── A trip = one project (e.g. Spring Break 2026) ───────────────────────────

export type TripType = 'road-trip' | 'group-tour';

export interface TripMeta {
  id: string;
  name: string;             // e.g. "Spring Break 2026"
  subtitle: string;
  startDate: string;        // ISO date: "2026-04-11"
  endDate: string;
  origin: {
    name: string;
    placeId: string;
  };
  travelers: string[];
  vehicle?: string;         // e.g. "Tesla Model Y" — omit for group tours
  tripType?: TripType;      // defaults to 'road-trip' if absent
  coverImage?: string;
  itineraryIds: string[];
}

// ─── The full loaded trip (meta + places + itineraries) ───────────────────────

export interface Trip {
  meta: TripMeta;
  places: Record<string, Place>;  // keyed by place.id
  itineraries: Itinerary[];
}

// ─── Reservations tracker ─────────────────────────────────────────────────────

export type ReservationStatus = 'needed' | 'contacted' | 'booked' | 'confirmed' | 'cancelled';

export type ReservationCategory =
  | 'hotel'
  | 'restaurant'
  | 'ski-rental'
  | 'lift-tickets'
  | 'activity'
  | 'tour'
  | 'flight'
  | 'train'
  | 'bus'
  | 'concert-ticket'
  | 'other';

export interface Reservation {
  id: string;
  tripId: string;
  itineraryId?: string;       // null = applies to all itineraries
  placeId?: string;           // links to a Place if applicable
  visitorId?: string;         // if set, this reservation belongs to a specific visitor plan
  name: string;               // e.g. "Hotel Vermont — 2 nights"
  category: ReservationCategory;
  status: ReservationStatus;
  date?: string;              // ISO date
  checkIn?: string;
  checkOut?: string;
  confirmationNumber?: string;
  cost?: number;
  notes?: string;
  bookingUrl?: string;
  createdAt: string;          // ISO datetime
  updatedAt: string;
}

// Persisted in localStorage under key: `reservations:${tripId}`
export type ReservationStore = Record<string, Reservation>; // keyed by reservation.id
