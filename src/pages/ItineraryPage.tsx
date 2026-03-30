import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import { listReservations } from '../utils/reservations';
import { isFavorite, toggleFavorite } from '../utils/favorites';
import {
  isCustomItinerary,
  updateCustomItinerary,
  addCustomItinerary,
  forkItinerary,
} from '../utils/customItineraries';
import type { Trip, Itinerary, Place, Day, ReservationStatus } from '../types';
import DayTable from '../components/DayTable';
import PlacePanel from '../components/PlacePanel';
import RouteMap from '../components/RouteMap';
import ReservationsTab from '../components/ReservationsTab';
import TripOverview from '../components/TripOverview';
import CompareView from '../components/CompareView';

type Tab = 'itinerary' | 'overview' | 'compare' | 'reservations';

export default function ItineraryPage() {
  const { tripId, itineraryId } = useParams<{ tripId: string; itineraryId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [tab, setTab] = useState<Tab>('itinerary');
  const [resTick, _setResTick] = useState(0);
  const [favTick, setFavTick] = useState(0);
  const [showCost, setShowCost] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Itinerary | null>(null);   // working copy when editing
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId).then((t) => {
      setTrip(t);
      const found = t.itineraries.find((i) => i.id === itineraryId);
      setItinerary(found ?? null);
    });
  }, [tripId, itineraryId]);

  // The "live" itinerary — draft when editing, base otherwise
  const liveItinerary = editing && draft ? draft : itinerary;

  /* ── Editing helpers ── */
  const startEditing = useCallback(() => {
    if (!itinerary) return;
    setDraft(JSON.parse(JSON.stringify(itinerary)));
    setEditing(true);
    setDirty(false);
  }, [itinerary]);

  const discardEdits = useCallback(() => {
    setDraft(null);
    setEditing(false);
    setDirty(false);
  }, []);

  const saveEdits = useCallback(() => {
    if (!tripId || !draft) return;

    // If editing an official itinerary, auto-fork it first
    if (!isCustomItinerary(tripId, draft.id)) {
      const forked = forkItinerary(draft, 'Edit');
      // Copy our edits into the fork
      const saved = { ...forked, days: draft.days, highlights: draft.highlights };
      addCustomItinerary(tripId, saved);
      // Navigate to the new custom itinerary
      loadTrip(tripId).then((t) => {
        setTrip(t);
        const found = t.itineraries.find((i) => i.id === saved.id);
        setItinerary(found ?? null);
        navigate(`/trip/${tripId}/itinerary/${saved.id}`, { replace: true });
      });
    } else {
      // Custom itinerary — update in-place
      updateCustomItinerary(tripId, draft);
      setItinerary(draft);
    }
    setDraft(null);
    setEditing(false);
    setDirty(false);
  }, [tripId, draft, navigate]);

  const updateDraft = useCallback((updater: (prev: Itinerary) => Itinerary) => {
    setDraft((prev) => prev ? updater(prev) : prev);
    setDirty(true);
  }, []);

  const handleUpdateDay = useCallback((dayIndex: number, updated: Day) => {
    updateDraft((prev) => {
      const newDays = [...prev.days];
      newDays[dayIndex] = updated;
      return { ...prev, days: newDays };
    });
  }, [updateDraft]);

  const handleRemoveDay = useCallback((dayIndex: number) => {
    updateDraft((prev) => ({
      ...prev,
      days: prev.days.filter((_, i) => i !== dayIndex),
    }));
  }, [updateDraft]);

  const handleAddDay = useCallback(() => {
    updateDraft((prev) => {
      const n = prev.days.length + 1;
      const lastDay = prev.days[prev.days.length - 1];
      const newDay: Day = {
        id: `${prev.id}-day${n}-${Date.now().toString(36)}`,
        label: `Day ${n}`,
        theme: 'TBD',
        legs: [],
        segments: [],
        overnightPlaceId: lastDay?.overnightPlaceId || '',
      };
      return { ...prev, days: [...prev.days, newDay] };
    });
  }, [updateDraft]);

  // Build placeId → best reservation status map for dot badges in the day table
  const reservationsByPlaceId = useMemo<Record<string, ReservationStatus>>(() => {
    if (!tripId || !itineraryId) return {};
    const STATUS_RANK: Record<ReservationStatus, number> = {
      needed: 0, contacted: 1, booked: 2, confirmed: 3, cancelled: -1,
    };
    const map: Record<string, ReservationStatus> = {};
    for (const r of listReservations(tripId, itineraryId)) {
      if (!r.placeId) continue;
      const existing = map[r.placeId];
      if (!existing || STATUS_RANK[r.status] > STATUS_RANK[existing]) {
        map[r.placeId] = r.status;
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, itineraryId, resTick]);

  if (!trip || !itinerary || !liveItinerary) {
    return <div className="p-8 text-stone-400">Loading…</div>;
  }

  // Compute itinerary-level cost totals (use liveItinerary for real-time updates)
  const totalActivityCost = liveItinerary.days.reduce(
    (sum, d) => sum + d.segments.reduce((s, seg) => s + (seg.costEstimate ?? 0), 0), 0
  );
  const totalLodgingCost = liveItinerary.days.reduce((sum, d) => sum + (d.lodgingCost ?? 0), 0);
  const grandTotal = totalActivityCost + totalLodgingCost;
  const hasCostData = grandTotal > 0;
  const isCustom = isCustomItinerary(tripId!, itinerary.id);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'itinerary',    label: 'Itinerary' },
    { id: 'overview',     label: 'Overview' },
    { id: 'compare',      label: 'Compare' },
    { id: 'reservations', label: 'Reservations' },
  ];

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
          <div className="flex items-center gap-2">
            {tripId && (() => {
              const fav = isFavorite(tripId, itinerary.id);
              void favTick;
              return (
                <button
                  onClick={() => { toggleFavorite(tripId, itinerary.id); setFavTick((t) => t + 1); }}
                  title={fav ? 'Remove from favourites' : 'Add to favourites'}
                  className={`text-2xl leading-none p-1 rounded transition-colors ${
                    fav ? 'text-amber-400 hover:text-amber-500' : 'text-stone-300 hover:text-amber-400'
                  }`}
                >
                  {fav ? '★' : '☆'}
                </button>
              );
            })()}
            <div>
              <h1 className="text-2xl font-bold text-stone-800">{liveItinerary.name}</h1>
              <p className="text-stone-500 text-sm mt-0.5">{liveItinerary.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full">
              {liveItinerary.days.length} days
            </span>
            <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full">
              ~{liveItinerary.totalMiles} miles
            </span>
            <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full">
              ⛷ {liveItinerary.skiDays} ski {liveItinerary.skiDays === 1 ? 'day' : 'days'}
            </span>
            {liveItinerary.includesMontreal && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">Montréal</span>
            )}
            {liveItinerary.includesPortland && (
              <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full">Portland</span>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-400 italic mt-2">{liveItinerary.vibe}</p>
        <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
          {liveItinerary.highlights.map((h, i) => (
            <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
              {h}
            </span>
          ))}
        </div>

        {/* ── Edit / Save / Discard bar ── */}
        <div className="flex items-center gap-2 mb-4">
          {!editing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-stone-200 text-stone-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title={isCustom ? 'Edit this itinerary' : 'Edit (creates a custom copy)'}
            >
              ✏️ {isCustom ? 'Edit' : 'Edit (creates copy)'}
            </button>
          ) : (
            <>
              <button
                onClick={saveEdits}
                disabled={!dirty}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  dirty
                    ? 'border-blue-400 bg-blue-600 text-white hover:bg-blue-700'
                    : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                }`}
              >
                💾 Save{!isCustom ? ' as Copy' : ''}
              </button>
              <button
                onClick={discardEdits}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-stone-200 text-stone-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                ✕ Discard
              </button>
              <button
                onClick={handleAddDay}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-stone-200 text-stone-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                + Add Day
              </button>
              {dirty && (
                <span className="text-xs text-amber-600 font-medium ml-2">● Unsaved changes</span>
              )}
            </>
          )}
        </div>

        {/* ── Cost toggle + grand total ── */}
        {hasCostData && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setShowCost((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                showCost
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              <span>{showCost ? '💲' : '💲'}</span>
              {showCost ? 'Hide Costs' : 'Show Costs'}
            </button>
            {showCost && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-600">
                  Activities <span className="font-bold">${totalActivityCost.toLocaleString()}</span>
                </span>
                <span className="text-emerald-600">
                  Lodging <span className="font-bold">${totalLodgingCost.toLocaleString()}</span>
                </span>
                <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                  Trip Total ${grandTotal.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-stone-800 text-stone-800'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className={`${tab === 'overview' || tab === 'compare' ? '' : 'max-w-3xl mx-auto'} px-4 py-6`}>

        {/* Itinerary tab */}
        {tab === 'itinerary' && (
          <>
            <div className="mb-6">
              <RouteMap itinerary={liveItinerary} places={trip.places} onPlaceClick={setSelectedPlace} />
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
                    <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
                    {label}
                  </div>
                ))}
              </div>
              {/* Reservation dot legend */}
              <div className="flex flex-wrap gap-3 mt-1.5 px-1 border-t border-stone-100 pt-2">
                <span className="text-xs text-stone-400 mr-1">Booking status:</span>
                {[
                  { color: 'bg-stone-200', label: 'Not tracked' },
                  { color: 'bg-red-400',   label: 'Needed' },
                  { color: 'bg-yellow-400',label: 'Contacted' },
                  { color: 'bg-blue-400',  label: 'Booked' },
                  { color: 'bg-green-500', label: 'Confirmed' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <DayTable
              days={liveItinerary.days}
              places={trip.places}
              onPlaceClick={setSelectedPlace}
              reservationsByPlaceId={reservationsByPlaceId}
              showCost={showCost}
              editing={editing}
              onUpdateDay={editing ? handleUpdateDay : undefined}
              onRemoveDay={editing ? handleRemoveDay : undefined}
            />
          </>
        )}

        {/* Overview tab */}
        {tab === 'overview' && (
          <TripOverview itinerary={liveItinerary} places={trip.places} onPlaceClick={setSelectedPlace} />
        )}

        {/* Compare tab */}
        {tab === 'compare' && (
          <CompareView
            currentItinerary={liveItinerary}
            allItineraries={trip.itineraries}
            places={trip.places}
            onPlaceClick={setSelectedPlace}
          />
        )}

        {/* Reservations tab */}
        {tab === 'reservations' && tripId && (
          <ReservationsTab
            tripId={tripId}
            itineraryId={itinerary.id}
            itineraryName={itinerary.name}
            places={trip.places}
            trip={trip}
            itinerary={itinerary}
          />
        )}
      </div>

      <PlacePanel place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
