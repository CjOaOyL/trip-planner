import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import type { Trip, Itinerary } from '../types';

export default function ItineraryPage() {
  const { tripId, itineraryId } = useParams<{ tripId: string; itineraryId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId).then((t) => {
      setTrip(t);
      const found = t.itineraries.find((i) => i.id === itineraryId);
      setItinerary(found ?? null);
    });
  }, [tripId, itineraryId]);

  if (!trip || !itinerary) return <div className="p-8 text-stone-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <button
        onClick={() => navigate(`/trip/${tripId}`)}
        className="text-sm text-stone-400 hover:text-stone-700 mb-6 block"
      >
        ← {trip.meta.name}
      </button>

      <h1 className="text-3xl font-bold text-stone-800 mb-1">{itinerary.name}</h1>
      <p className="text-stone-500 mb-6">{itinerary.tagline}</p>

      {/* Placeholder for map — coming next */}
      <div className="bg-stone-200 rounded-2xl h-64 flex items-center justify-center text-stone-400 mb-8">
        Map goes here
      </div>

      {/* Day-by-day table — coming next */}
      <div className="space-y-4">
        {itinerary.days.map((day) => (
          <div key={day.id} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <div className="font-semibold text-stone-700">{day.label}</div>
            <div className="text-sm text-stone-400">{day.theme}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
