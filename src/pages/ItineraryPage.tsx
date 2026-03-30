import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrip } from '../utils/loadTrip';
import { listReservations } from '../utils/reservations';
import { isFavorite, toggleFavorite } from '../utils/favorites';
import type { Trip, Itinerary, Place, ReservationStatus } from '../types';
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

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId).then((t) => {
      setTrip(t);
      const found = t.itineraries.find((i) => i.id === itineraryId);
      setItinerary(found ?? null);
    });
  }, [tripId, itineraryId]);

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

  if (!trip || !itinerary) {
    return <div className="p-8 text-stone-400">Loading…</div>;
  }

  // Compute itinerary-level cost totals
  const totalActivityCost = itinerary.days.reduce(
    (sum, d) => sum + d.segments.reduce((s, seg) => s + (seg.costEstimate ?? 0), 0), 0
  );
  const totalLodgingCost = itinerary.days.reduce((sum, d) => sum + (d.lodgingCost ?? 0), 0);
  const grandTotal = totalActivityCost + totalLodgingCost;
  const hasCostData = grandTotal > 0;

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
              <h1 className="text-2xl font-bold text-stone-800">{itinerary.name}</h1>
              <p className="text-stone-500 text-sm mt-0.5">{itinerary.tagline}</p>
            </div>
          </div>
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
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">Montréal</span>
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
              <RouteMap itinerary={itinerary} places={trip.places} onPlaceClick={setSelectedPlace} />
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
              days={itinerary.days}
              places={trip.places}
              onPlaceClick={setSelectedPlace}
              reservationsByPlaceId={reservationsByPlaceId}
              showCost={showCost}
            />
          </>
        )}

        {/* Overview tab */}
        {tab === 'overview' && (
          <TripOverview itinerary={itinerary} places={trip.places} onPlaceClick={setSelectedPlace} />
        )}

        {/* Compare tab */}
        {tab === 'compare' && (
          <CompareView
            currentItinerary={itinerary}
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
