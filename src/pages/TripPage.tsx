import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import { isArchived, archiveItinerary, unarchiveItinerary } from '../utils/archive';
import type { Trip, Itinerary } from '../types';

export default function TripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tick, setTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId).then(setTrip);
  }, [tripId]);

  if (!trip) return <div className="p-8 text-stone-400">Loading…</div>;

  function checkArchived(it: Itinerary) {
    return isArchived(trip!.meta.id, it.id, it.archived);
  }

  const active   = trip.itineraries.filter((it) => !checkArchived(it));
  const archived = trip.itineraries.filter((it) => checkArchived(it));

  function toggleArchive(it: Itinerary) {
    if (checkArchived(it)) {
      unarchiveItinerary(trip!.meta.id, it.id);
    } else {
      archiveItinerary(trip!.meta.id, it.id);
    }
    setTick((t) => t + 1);
  }

  void tick;

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-700 mb-6 block">
        ← All Trips
      </button>

      <h1 className="text-3xl font-bold text-stone-800 mb-1">{trip.meta.name}</h1>
      <p className="text-stone-500 mb-1">{trip.meta.subtitle}</p>
      <p className="text-sm text-stone-400 mb-8">
        {trip.meta.startDate} → {trip.meta.endDate} &nbsp;·&nbsp; From {trip.meta.origin.name} &nbsp;·&nbsp; {trip.meta.vehicle}
      </p>

      <h2 className="text-xl font-semibold text-stone-700 mb-4">Choose an Itinerary</h2>
      <div className="grid gap-4 max-w-2xl mb-10">
        {active.map((it) => (
          <ItineraryCard
            key={it.id}
            itinerary={it}
            onSelect={() => navigate(`/trip/${tripId}/itinerary/${it.id}`)}
            onArchive={() => toggleArchive(it)}
            archived={false}
          />
        ))}
        {active.length === 0 && (
          <p className="text-stone-400 text-sm italic">All itineraries are archived. Restore one below.</p>
        )}
      </div>

      {/* Archived section */}
      {archived.length > 0 && (
        <div className="max-w-2xl">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 mb-3"
          >
            <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>▶</span>
            Archived ({archived.length})
          </button>

          {showArchived && (
            <div className="grid gap-3">
              {archived.map((it) => (
                <ItineraryCard
                  key={it.id}
                  itinerary={it}
                  onSelect={() => navigate(`/trip/${tripId}/itinerary/${it.id}`)}
                  onArchive={() => toggleArchive(it)}
                  archived={true}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  itinerary: Itinerary;
  onSelect: () => void;
  onArchive: () => void;
  archived: boolean;
}

function ItineraryCard({ itinerary: it, onSelect, onArchive, archived }: CardProps) {
  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${
      archived ? 'border-stone-100 opacity-60' : 'border-stone-200 hover:shadow-md hover:border-stone-300'
    }`}>
      <div className="flex items-start gap-3">
        {/* Main clickable area */}
        <button onClick={onSelect} className="flex-1 text-left">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-stone-800">{it.name}</div>
              <div className="text-stone-500 text-sm mt-0.5">{it.tagline}</div>
              <div className="text-stone-400 text-xs mt-1.5 italic">{it.vibe}</div>
            </div>
            <div className="flex flex-col gap-1 text-xs text-right shrink-0">
              <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{it.days.length} days</span>
              <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">⛷ {it.skiDays} ski</span>
              {it.includesMontreal && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Montréal</span>}
              {it.includesPortland && <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Portland</span>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {it.highlights.slice(0, 5).map((h, i) => (
              <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{h}</span>
            ))}
          </div>
        </button>

        {/* Archive / restore button */}
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(); }}
          title={archived ? 'Restore itinerary' : 'Archive itinerary'}
          className="shrink-0 mt-1 text-stone-300 hover:text-stone-600 text-lg leading-none p-1 rounded hover:bg-stone-100 transition-colors"
        >
          {archived ? '↩' : '⊖'}
        </button>
      </div>
    </div>
  );
}
