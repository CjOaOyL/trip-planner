import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import type { Trip } from '../types';

export default function TripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId)
      .then(setTrip)
      .catch(() => setError('Could not load trip data.'));
  }, [tripId]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!trip) return <div className="p-8 text-stone-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-700 mb-6 block">
        ← All Trips
      </button>

      <h1 className="text-3xl font-bold text-stone-800 mb-1">{trip.meta.name}</h1>
      <p className="text-stone-500 mb-2">{trip.meta.subtitle}</p>
      <p className="text-sm text-stone-400 mb-8">
        {trip.meta.startDate} → {trip.meta.endDate} &nbsp;·&nbsp; Departing from {trip.meta.origin.name} &nbsp;·&nbsp; {trip.meta.vehicle}
      </p>

      <h2 className="text-xl font-semibold text-stone-700 mb-4">Choose an Itinerary</h2>
      <div className="grid gap-4 max-w-2xl">
        {trip.itineraries.map((it) => (
          <button
            key={it.id}
            onClick={() => navigate(`/trip/${tripId}/itinerary/${it.id}`)}
            className="bg-white border border-stone-200 rounded-2xl p-6 text-left shadow-sm hover:shadow-md hover:border-brand-500 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-stone-800">{it.name}</div>
                <div className="text-stone-500 text-sm mt-1">{it.tagline}</div>
                <div className="text-stone-400 text-xs mt-2 italic">{it.vibe}</div>
              </div>
              <div className="flex flex-col gap-1 text-xs text-right shrink-0">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {it.skiDays} ski {it.skiDays === 1 ? 'day' : 'days'}
                </span>
                {it.includesMontreal && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Montreal</span>
                )}
                {it.includesPortland && (
                  <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Portland</span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {it.highlights.map((h, i) => (
                <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{h}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
