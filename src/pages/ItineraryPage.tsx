import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import type { Trip, Itinerary, Place } from '../types';
import DayTable from '../components/DayTable';
import PlacePanel from '../components/PlacePanel';
import RouteMap from '../components/RouteMap';
import ReservationsTab from '../components/ReservationsTab';

type Tab = 'itinerary' | 'reservations';

export default function ItineraryPage() {
  const { tripId, itineraryId } = useParams<{ tripId: string; itineraryId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [tab, setTab] = useState<Tab>('itinerary');

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId).then((t) => {
      setTrip(t);
      const found = t.itineraries.find((i) => i.id === itineraryId);
      setItinerary(found ?? null);
    });
  }, [tripId, itineraryId]);

  if (!trip || !itinerary) {
    return <div className="p-8 text-stone-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-stone-200 px-6 pt-4 pb-0">
        <button
          onClick={() => navigate(`/trip/${tripId}`)}
          className="text-sm text-stone-400 hover:text-stone-700 mb-3 block"
        >
          ← {trip.meta.name}
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">{itinerary.name}</h1>
            <p className="text-stone-500 text-sm mt-0.5">{itinerary.tagline}</p>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full">
              {itinerary.days.length} days
            </span>
            <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full">
              ~{itinerary.totalMiles} miles
            </span>
            <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full">
              ⛷ {itinerary.skiDays} ski {itinerary.skiDays === 1 ? 'day' : 'days'}
            </span>
            {itinerary.includesMontreal && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">Montreal</span>
            )}
            {itinerary.includesPortland && (
              <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full">Portland</span>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-400 italic mt-2">{itinerary.vibe}</p>

        <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
          {itinerary.highlights.map((h, i) => (
            <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
              {h}
            </span>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0 -mb-px">
          {([['itinerary', 'Itinerary'], ['reservations', 'Reservations']] as [Tab, string][]).map(
            ([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === id
                    ? 'border-stone-800 text-stone-800'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {tab === 'itinerary' && (
          <>
            {/* Route map */}
            <div className="mb-6">
              <RouteMap
                itinerary={itinerary}
                places={trip.places}
                onPlaceClick={setSelectedPlace}
              />
              <div className="flex flex-wrap gap-3 mt-2 px-1">
                {[
                  { color: '#6366f1', label: 'University' },
                  { color: '#0ea5e9', label: 'Ski Resort' },
                  { color: '#f97316', label: 'Restaurant' },
                  { color: '#f59e0b', label: 'Museum' },
                  { color: '#ec4899', label: 'Neighborhood' },
                  { color: '#22c55e', label: 'Charger ⚡' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Day table */}
            <DayTable
              days={itinerary.days}
              places={trip.places}
              onPlaceClick={setSelectedPlace}
            />
          </>
        )}

        {tab === 'reservations' && tripId && (
          <ReservationsTab
            tripId={tripId}
            itineraryId={itinerary.id}
            itineraryName={itinerary.name}
            places={trip.places}
          />
        )}
      </div>

      {/* ── Place detail panel ── */}
      <PlacePanel place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
