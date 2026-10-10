/**
 * Flight scenarios: pick one option per flight leg (reservation) and save the
 * combination for a trip.
 *
 *   Scenarios: `flight-scenarios:${tripId}`  → FlightScenario[]
 */
import type { BookingOption, FlightDetails, FlightScenario, Reservation } from '../types';

function scenariosKey(tripId: string) {
  return `flight-scenarios:${tripId}`;
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

export function getFlightScenarios(tripId: string): FlightScenario[] {
  try {
    const raw = localStorage.getItem(scenariosKey(tripId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(tripId: string, scenarios: FlightScenario[]) {
  localStorage.setItem(scenariosKey(tripId), JSON.stringify(scenarios));
}

export function saveFlightScenario(
  tripId: string,
  input: Omit<FlightScenario, 'id' | 'tripId' | 'createdAt' | 'updatedAt'> & { id?: string },
): FlightScenario {
  const all = getFlightScenarios(tripId);
  const now = new Date().toISOString();
  const existing = input.id ? all.find((s) => s.id === input.id) : undefined;
  const scenario: FlightScenario = existing
    ? { ...existing, ...input, id: existing.id, tripId, updatedAt: now }
    : { ...input, id: `fs-${Date.now().toString(36)}`, tripId, createdAt: now, updatedAt: now };
  const next = existing ? all.map((s) => (s.id === scenario.id ? scenario : s)) : [...all, scenario];
  saveAll(tripId, next);
  return scenario;
}

export function deleteFlightScenario(tripId: string, scenarioId: string) {
  saveAll(tripId, getFlightScenarios(tripId).filter((s) => s.id !== scenarioId));
  // Remember the deletion so a repo-seeded scenario doesn't come back on reload.
  const consumed = getSeedConsumed(tripId);
  consumed.add(scenarioId);
  localStorage.setItem(seedConsumedKey(tripId), JSON.stringify([...consumed]));
}

function seedConsumedKey(tripId: string) {
  return `flight-scenarios-seed-consumed:${tripId}`;
}
function getSeedConsumed(tripId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seedConsumedKey(tripId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export type SeedFlightScenario = Omit<FlightScenario, 'tripId' | 'createdAt' | 'updatedAt'>;

/** Add repo-defined scenarios once; user edits/deletes win afterwards. */
export function mergeSeedFlightScenarios(tripId: string, seed: SeedFlightScenario[]): void {
  if (!seed?.length) return;
  const all = getFlightScenarios(tripId);
  const consumed = getSeedConsumed(tripId);
  const now = new Date().toISOString();
  let dirty = false;
  for (const s of seed) {
    if (consumed.has(s.id) || all.some((x) => x.id === s.id)) continue;
    all.push({ ...s, tripId, createdAt: now, updatedAt: now });
    consumed.add(s.id);
    dirty = true;
  }
  if (dirty) {
    saveAll(tripId, all);
    localStorage.setItem(seedConsumedKey(tripId), JSON.stringify([...consumed]));
  }
}

// ─── Flight helpers ──────────────────────────────────────────────────────────

/** Parse a local ISO datetime ("2026-11-05T20:01") as a local Date. */
export function parseLocal(iso: string): Date {
  const [d, t = '00:00'] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm);
}

export function durationMinutes(f: FlightDetails): number {
  return Math.round((parseLocal(f.arrive).getTime() - parseLocal(f.depart).getTime()) / 60000);
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatTime(iso: string): string {
  const d = parseLocal(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function formatDay(iso: string): string {
  const d = parseLocal(iso);
  return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`;
}

/** Number of calendar days the arrival is after the departure (0 = same day). */
export function dayOffset(f: FlightDetails): number {
  const a = parseLocal(f.arrive);
  const d = parseLocal(f.depart);
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((a0 - d0) / 86400000);
}

export function perPerson(o: BookingOption): number | undefined {
  if (o.totalPrice == null || !o.flight?.passengers) return undefined;
  return o.totalPrice / o.flight.passengers;
}


/** Flight legs = flight reservations that have at least one structured option. */
export function flightLegs(reservations: Reservation[]): Reservation[] {
  return reservations.filter(
    (r) => r.category === 'flight' && (r.options ?? []).some((o) => o.flight),
  );
}

export interface ScenarioTotals {
  fare: number;             // sum of totalPrice across selected options
  passengers: number;       // sum of seats across selected options
  legsSelected: number;
  legsTotal: number;
}

export function scenarioTotals(legs: Reservation[], selections: Record<string, string>): ScenarioTotals {
  let fare = 0;
  let passengers = 0;
  let legsSelected = 0;
  for (const leg of legs) {
    const o = (leg.options ?? []).find((x) => x.id === selections[leg.id]);
    if (!o || o.totalPrice == null) continue;
    legsSelected += 1;
    fare += o.totalPrice;
    passengers += o.flight?.passengers ?? 0;
  }
  return { fare, passengers, legsSelected, legsTotal: legs.length };
}
