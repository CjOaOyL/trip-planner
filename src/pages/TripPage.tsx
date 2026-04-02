import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import { isArchived, archiveItinerary, unarchiveItinerary } from '../utils/archive';
import { isFavorite, toggleFavorite } from '../utils/favorites';
import { forkItinerary, addCustomItinerary, deleteCustomItinerary, isCustomItinerary, createBlankItinerary } from '../utils/customItineraries';
import type { Trip, Itinerary } from '../types';

export default function TripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tick, setTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDays, setNewDays] = useState(7);

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId).then(setTrip);
  }, [tripId]);

  if (!trip) return <div className="p-8 text-stone-400">Loading…</div>;

  function checkArchived(it: Itinerary) {
    return isArchived(trip!.meta.id, it.id, it.archived);
  }

  const active   = trip.itineraries
    .filter((it) => !checkArchived(it))
    .sort((a, b) => {
      const af = isFavorite(trip!.meta.id, a.id) ? 0 : 1;
      const bf = isFavorite(trip!.meta.id, b.id) ? 0 : 1;
      return af - bf;
    });
  const archived = trip.itineraries.filter((it) => checkArchived(it));

  function toggleArchive(it: Itinerary) {
    if (checkArchived(it)) {
      unarchiveItinerary(trip!.meta.id, it.id);
    } else {
      archiveItinerary(trip!.meta.id, it.id);
    }
    setTick((t) => t + 1);
  }

  function handleToggleFavorite(it: Itinerary) {
    toggleFavorite(trip!.meta.id, it.id);
    setTick((t) => t + 1);
  }

  function handleFork(it: Itinerary) {
    const forked = forkItinerary(it);
    addCustomItinerary(trip!.meta.id, forked);
    // Reload to pick up the new itinerary
    loadTrip(trip!.meta.id).then((t) => {
      setTrip(t);
      setTick((prev) => prev + 1);
    });
  }

  function handleDelete(it: Itinerary) {
    if (!confirm(`Delete "${it.name}"? This cannot be undone.`)) return;
    deleteCustomItinerary(trip!.meta.id, it.id);
    loadTrip(trip!.meta.id).then((t) => {
      setTrip(t);
      setTick((prev) => prev + 1);
    });
  }

  function handleCreate() {
    const name = newName.trim() || 'My Itinerary';
    const blank = createBlankItinerary({ name, numDays: newDays, startDate: trip!.meta.startDate, originPlaceId: trip!.meta.origin.placeId });
    addCustomItinerary(trip!.meta.id, blank);
    loadTrip(trip!.meta.id).then((t) => {
      setTrip(t);
      setTick((prev) => prev + 1);
      setCreating(false);
      setNewName('');
      setNewDays(7);
      // Navigate into the new itinerary in edit mode
      navigate(`/trip/${tripId}/itinerary/${blank.id}`);
    });
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
            tripId={trip.meta.id}
            onSelect={() => navigate(`/trip/${tripId}/itinerary/${it.id}`)}
            onArchive={() => toggleArchive(it)}
            onToggleFavorite={() => handleToggleFavorite(it)}
            onFork={() => handleFork(it)}
            onDelete={isCustomItinerary(trip.meta.id, it.id) ? () => handleDelete(it) : undefined}
            archived={false}
            favorited={isFavorite(trip.meta.id, it.id)}
            isCustom={isCustomItinerary(trip.meta.id, it.id)}
          />
        ))}
        {active.length === 0 && (
          <p className="text-stone-400 text-sm italic">All itineraries are archived. Restore one below.</p>
        )}
      </div>

      {/* Create New Itinerary */}
      <div className="max-w-2xl mb-10">
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-stone-300 hover:border-blue-400 rounded-2xl px-5 py-4 w-full transition-colors"
          >
            <span className="text-lg">＋</span> Create New Itinerary
          </button>
        ) : (
          <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">New Itinerary</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="flex-1 min-w-[180px]">
                <span className="text-xs text-stone-500 block mb-1">Name</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Custom Itinerary"
                  className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </label>
              <label className="w-28">
                <span className="text-xs text-stone-500 block mb-1">Days</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newDays}
                  onChange={(e) => setNewDays(Math.max(1, Math.min(30, Number(e.target.value))))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>
              <button
                onClick={handleCreate}
                className="text-sm font-medium px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(''); setNewDays(7); }}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
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
                  tripId={trip.meta.id}
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
  tripId?: string;
  onSelect: () => void;
  onArchive: () => void;
  onToggleFavorite?: () => void;
  onFork?: () => void;
  onDelete?: () => void;
  archived: boolean;
  favorited?: boolean;
  isCustom?: boolean;
}

function ItineraryCard({
  itinerary: it,
  onSelect,
  onArchive,
  onToggleFavorite,
  onFork,
  onDelete,
  archived,
  favorited,
  isCustom,
}: CardProps) {
  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${
      archived ? 'border-stone-100 opacity-60' : favorited ? 'border-amber-300 ring-1 ring-amber-200 hover:shadow-md' : 'border-stone-200 hover:shadow-md hover:border-stone-300'
    }`}>
      <div className="flex items-start gap-3">
        {/* Star / favourite */}
        {!archived && onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            title={favorited ? 'Remove from favourites' : 'Add to favourites'}
            className={`shrink-0 mt-1 text-xl leading-none p-1 rounded transition-colors ${
              favorited ? 'text-amber-400 hover:text-amber-500' : 'text-stone-300 hover:text-amber-400'
            }`}
          >
            {favorited ? '★' : '☆'}
          </button>
        )}

        {/* Main clickable area */}
        <button onClick={onSelect} className="flex-1 text-left">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-stone-800 flex items-center gap-2">
                {it.name}
                {isCustom && <span className="text-[10px] font-medium bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">custom</span>}
              </div>
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

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
          {/* Fork / create alternative */}
          {!archived && onFork && (
            <button
              onClick={(e) => { e.stopPropagation(); onFork(); }}
              title="Create alternative (fork)"
              className="text-stone-300 hover:text-indigo-500 text-base leading-none p-1 rounded hover:bg-indigo-50 transition-colors"
            >
              ⑂
            </button>
          )}

          {/* Archive / restore */}
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            title={archived ? 'Restore itinerary' : 'Archive itinerary'}
            className="text-stone-300 hover:text-stone-600 text-lg leading-none p-1 rounded hover:bg-stone-100 transition-colors"
          >
            {archived ? '↩' : '⊖'}
          </button>

          {/* Delete (custom only) */}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete custom itinerary"
              className="text-stone-300 hover:text-red-500 text-base leading-none p-1 rounded hover:bg-red-50 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
