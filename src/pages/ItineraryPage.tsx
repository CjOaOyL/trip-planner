import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import type { Trip, Itinerary, Place } from '../types';
import DayTable from '../components/DayTable';
import PlacePanel from '../components/PlacePanel';

export default function ItineraryPage() {
  const { tripId, itineraryId } = useParams<{ tripId: string; itineraryId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

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
      <div className="bg-white border-b border-stone-200 px-6 py-4">
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

        {/* Vibe line */}
        <p className="text-xs text-stone-400 italic mt-2">{itinerary.vibe}</p>

        {/* Highlights */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {itinerary.highlights.map((h, i) => (
            <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Map placeholder — will be replaced with Leaflet map */}
        <div className="bg-stone-200 rounded-2xl h-52 flex items-center justify-center text-stone-400 text-sm mb-6">
          Map coming next
        </div>

        {/* Day table */}
        <DayTable
          days={itinerary.days}
          places={trip.places}
          onPlaceClick={setSelectedPlace}
        />
      </div>

      {/* ── Place detail slide-in panel ── */}
      <PlacePanel place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
