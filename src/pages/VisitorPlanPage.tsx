import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import type { Trip, Itinerary, Segment, Day } from '../types';
import { createReservation, listReservations } from '../utils/reservations';

// ─── Types ────────────────────────────────────────────────────────────────────

type Attendance = 'going' | 'maybe' | 'skip';

interface EventDecision {
  dayId: string;
  segmentIndex: number;
  segment: Segment;
  attendance: Attendance;
}

interface CityStay {
  city: string;
  placeId: string;
  checkIn: string;   // day label
  checkOut: string;  // day label
  nights: number;
  dayLabels: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCityStays(decisions: EventDecision[], days: Day[]): CityStay[] {
  // Find which days the visitor is attending at least one event
  const activeDayIds = new Set(
    decisions.filter((d) => d.attendance !== 'skip').map((d) => d.dayId),
  );

  // Group consecutive active days by overnight location
  const stays: CityStay[] = [];
  let current: CityStay | null = null;

  for (const day of days) {
    if (!activeDayIds.has(day.id)) {
      if (current) { stays.push(current); current = null; }
      continue;
    }
    const placeId = day.overnightPlaceId;
    if (current && current.placeId === placeId) {
      current.nights++;
      current.checkOut = day.label;
      current.dayLabels.push(day.label);
    } else {
      if (current) stays.push(current);
      current = { city: placeId, placeId, checkIn: day.label, checkOut: day.label, nights: 1, dayLabels: [day.label] };
    }
  }
  if (current) stays.push(current);
  return stays;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = (tripId: string, visitorId: string) => `visitor-plan:${tripId}:${visitorId}`;

function loadPlan(tripId: string, visitorId: string): Record<string, Attendance> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(tripId, visitorId)) ?? '{}'); }
  catch { return {}; }
}

function savePlan(tripId: string, visitorId: string, plan: Record<string, Attendance>) {
  localStorage.setItem(STORAGE_KEY(tripId, visitorId), JSON.stringify(plan));
}

function segKey(dayId: string, segIdx: number) { return `${dayId}:${segIdx}`; }

// ─── Attendance button ─────────────────────────────────────────────────────────

const ATTEND_CONFIG: Record<Attendance, { label: string; active: string; icon: string }> = {
  going: { label: 'Going',  icon: '✓', active: 'bg-emerald-500 text-white border-emerald-500' },
  maybe: { label: 'Maybe',  icon: '?', active: 'bg-amber-400 text-white border-amber-400' },
  skip:  { label: 'Skip',   icon: '—', active: 'bg-stone-300 text-stone-600 border-stone-300' },
};

function AttendBtn({ value, current, onChange }: { value: Attendance; current: Attendance; onChange: (v: Attendance) => void }) {
  const cfg = ATTEND_CONFIG[value];
  const isActive = current === value;
  return (
    <button
      onClick={() => onChange(value)}
      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${
        isActive ? cfg.active : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400'
      }`}
    >
      {cfg.icon} {cfg.label}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VisitorPlanPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Attendance>>({});
  const [generated, setGenerated] = useState(false);

  // Load trip
  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId).then(setTrip);
  }, [tripId]);

  // Load saved plan on name confirm
  useEffect(() => {
    if (!confirmed || !tripId || !visitorName) return;
    setDecisions(loadPlan(tripId, visitorName));
  }, [confirmed, tripId, visitorName]);

  // Use the visitor-guide itinerary (id ending in 'visitor-guide') or fall back to first
  const itinerary: Itinerary | null = useMemo(() => {
    if (!trip) return null;
    return (
      trip.itineraries.find((i) => i.id.includes('visitor')) ??
      trip.itineraries[0] ??
      null
    );
  }, [trip]);

  if (!trip) return <div className="p-8 text-stone-400">Loading…</div>;

  // ── Name entry screen ──
  if (!confirmed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="max-w-sm w-full mx-4 bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-3">👥</div>
            <h1 className="text-xl font-bold text-stone-800">Plan Your Visit</h1>
            <p className="text-sm text-stone-500 mt-1">{trip.meta.name}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Your name
            </label>
            <input
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Aunt Maya"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && visitorName.trim() && setConfirmed(true)}
            />
            <p className="text-xs text-stone-400 mt-2">Your plan is saved locally to this name.</p>
          </div>
          <button
            disabled={!visitorName.trim()}
            onClick={() => setConfirmed(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Start Planning →
          </button>
          <button onClick={() => navigate(`/trip/${tripId}`)} className="w-full text-sm text-stone-400 hover:text-stone-700">
            ← Back to trip
          </button>
        </div>
      </div>
    );
  }

  if (!itinerary) return <div className="p-8 text-stone-400">No visitor guide found for this trip.</div>;

  function setAttendance(dayId: string, segIdx: number, value: Attendance) {
    const key = segKey(dayId, segIdx);
    const next = { ...decisions, [key]: value };
    setDecisions(next);
    if (tripId) savePlan(tripId, visitorName, next);
  }

  function getAttendance(dayId: string, segIdx: number): Attendance {
    return decisions[segKey(dayId, segIdx)] ?? 'skip';
  }

  // Collect all open-to-visitor events with decisions
  const allDecisions: EventDecision[] = itinerary.days.flatMap((day) =>
    day.segments
      .map((seg, idx) => ({ dayId: day.id, segmentIndex: idx, segment: seg, attendance: getAttendance(day.id, idx) }))
      .filter((d) => !d.segment.openTo || d.segment.openTo.includes('visitor')),
  );

  const cityStays = buildCityStays(allDecisions, itinerary.days);
  const goingCount = allDecisions.filter((d) => d.attendance === 'going').length;
  const concerts = allDecisions.filter((d) => d.segment.eventType === 'concert');

  // Generate booking stubs
  function generateBookingList() {
    if (!tripId) return;
    const existing = listReservations(tripId);
    const existingNames = new Set(existing.map((r) => r.name));

    // Hotels per city stay
    cityStays.forEach((stay) => {
      const name = `Hotel in ${stay.city} — ${stay.nights} night${stay.nights > 1 ? 's' : ''} (${stay.checkIn})`;
      if (!existingNames.has(name)) {
        createReservation(tripId, { visitorId: visitorName, name, category: 'hotel', status: 'needed', checkIn: stay.checkIn, checkOut: stay.checkOut });
      }
    });

    // Flights — in and out
    if (cityStays.length > 0) {
      const firstCity = cityStays[0].city;
      const lastCity = cityStays[cityStays.length - 1].city;
      [`Flight: Home → ${firstCity}`, `Flight: ${lastCity} → Home`].forEach((name) => {
        if (!existingNames.has(name)) {
          createReservation(tripId, { visitorId: visitorName, name, category: 'flight', status: 'needed' });
        }
      });

      // Ground transport between cities
      for (let i = 1; i < cityStays.length; i++) {
        const name = `Transport: ${cityStays[i - 1].city} → ${cityStays[i].city}`;
        if (!existingNames.has(name)) {
          createReservation(tripId, { visitorId: visitorName, name, category: 'train', status: 'needed' });
        }
      }
    }

    // Concert tickets where ticketed: true
    concerts
      .filter((d) => d.attendance !== 'skip' && d.segment.ticketed)
      .forEach((d) => {
        const name = `Ticket: ${d.segment.activity}`;
        if (!existingNames.has(name)) {
          createReservation(tripId, { visitorId: visitorName, name, category: 'concert-ticket', status: 'needed' });
        }
      });

    setGenerated(true);
  }

  // ─── Main planning view ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-10">
        <button onClick={() => navigate(`/trip/${tripId}`)} className="text-sm text-stone-400 hover:text-stone-700 mb-1 block">
          ← {trip.meta.name}
        </button>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-stone-800">Plan Your Visit</h1>
            <p className="text-stone-500 text-sm">{visitorName} · {goingCount} event{goingCount !== 1 ? 's' : ''} selected</p>
          </div>
          <button
            onClick={() => setConfirmed(false)}
            className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 px-3 py-1.5 rounded-lg"
          >
            Switch visitor
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Instructions */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 text-sm text-indigo-800">
          <p className="font-semibold mb-1">How this works</p>
          <p>Mark each event as <strong>Going</strong>, <strong>Maybe</strong>, or <strong>Skip</strong>. When you're done, the app will generate your hotel and transport booking list automatically.</p>
        </div>

        {/* Day-by-day events */}
        {itinerary.days.map((day) => {
          const visitorSegs = day.segments
            .map((seg, idx) => ({ seg, idx }))
            .filter(({ seg }) => !seg.openTo || seg.openTo.includes('visitor'));

          if (visitorSegs.length === 0) return null;

          return (
            <section key={day.id}>
              <h2 className="text-sm font-bold text-stone-600 uppercase tracking-wider mb-3 pb-1 border-b border-stone-200">
                {day.label}
              </h2>
              <div className="space-y-3">
                {visitorSegs.map(({ seg, idx }) => {
                  const att = getAttendance(day.id, idx);
                  const place = trip.places[seg.placeId];
                  const isConcert = seg.eventType === 'concert';

                  return (
                    <div
                      key={idx}
                      className={`bg-white rounded-xl border p-4 transition-all ${
                        att === 'going'
                          ? 'border-emerald-300 shadow-sm'
                          : att === 'maybe'
                          ? 'border-amber-200'
                          : 'border-stone-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Event type + concert star */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {isConcert && <span className="text-sm font-bold text-purple-600">★ Concert</span>}
                            {seg.ticketed && (
                              <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                🎟 Ticket may be required
                              </span>
                            )}
                          </div>

                          <p className="font-medium text-stone-800 text-sm">{seg.activity}</p>

                          {place && (
                            <p className="text-xs text-stone-500 mt-0.5">{place.name}{place.address ? ` · ${place.address}` : ''}</p>
                          )}

                          {seg.notes && (
                            <p className="text-xs text-stone-400 italic mt-1">{seg.notes}</p>
                          )}

                          {seg.time && seg.time !== 'All day' && (
                            <p className="text-xs text-stone-400 mt-1">⏰ {seg.time}</p>
                          )}
                        </div>

                        {/* Attendance buttons */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {(['going', 'maybe', 'skip'] as Attendance[]).map((v) => (
                            <AttendBtn key={v} value={v} current={att} onChange={(val) => setAttendance(day.id, idx, val)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Booking summary */}
        {goingCount > 0 && (
          <section className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <h2 className="font-bold text-stone-800">Your Booking Summary</h2>

            {/* City stays */}
            {cityStays.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Hotels needed</p>
                <ul className="space-y-2">
                  {cityStays.map((stay, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-lg">🏨</span>
                      <div>
                        <span className="font-medium text-stone-700">{stay.city}</span>
                        <span className="text-stone-400 ml-2">{stay.nights} night{stay.nights > 1 ? 's' : ''}</span>
                        <p className="text-xs text-stone-400">{stay.checkIn}{stay.nights > 1 ? ` → ${stay.checkOut}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Flights */}
            {cityStays.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Flights</p>
                <ul className="space-y-1.5 text-sm text-stone-700">
                  <li className="flex items-center gap-2">✈️ <span>Home → <strong>{cityStays[0].city}</strong> (arrive by {cityStays[0].checkIn})</span></li>
                  {cityStays.length > 1 && cityStays.map((stay, i) => i > 0 ? (
                    <li key={i} className="flex items-center gap-2">🚂 <span><strong>{cityStays[i - 1].city}</strong> → <strong>{stay.city}</strong></span></li>
                  ) : null)}
                  <li className="flex items-center gap-2">✈️ <span><strong>{cityStays[cityStays.length - 1].city}</strong> → Home (after {cityStays[cityStays.length - 1].checkOut})</span></li>
                </ul>
              </div>
            )}

            {/* Ticketed concerts */}
            {concerts.filter((d) => d.attendance !== 'skip' && d.segment.ticketed).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Concert tickets to check</p>
                <ul className="space-y-1 text-sm text-stone-700">
                  {concerts
                    .filter((d) => d.attendance !== 'skip' && d.segment.ticketed)
                    .map((d, i) => (
                      <li key={i} className="flex items-center gap-2">🎟 <span>{d.segment.activity}</span></li>
                    ))}
                </ul>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={generateBookingList}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                generated
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {generated ? '✓ Booking list added to Reservations' : 'Generate My Booking List →'}
            </button>
            {generated && (
              <button
                onClick={() => navigate(`/trip/${tripId}/itinerary/02-visitor-guide`)}
                className="w-full text-sm text-indigo-600 hover:underline text-center"
              >
                View in Reservations tab →
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
