import type { Leg, Place } from '../types';

interface Props {
  leg: Leg;
  places: Record<string, Place>;
  onPlaceClick: (place: Place) => void;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function LegCard({ leg, places, onPlaceClick }: Props) {
  const from = places[leg.fromPlaceId];
  const to = places[leg.toPlaceId];

  return (
    <div className="bg-white rounded-lg border border-blue-100 p-3 text-sm">
      {/* From → To */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => from && onPlaceClick(from)}
          className="font-medium text-stone-700 hover:text-brand-600 hover:underline"
        >
          {from?.name ?? leg.fromPlaceId}
        </button>
        <span className="text-stone-300">→</span>
        <button
          onClick={() => to && onPlaceClick(to)}
          className="font-medium text-stone-700 hover:text-brand-600 hover:underline"
        >
          {to?.name ?? leg.toPlaceId}
        </button>

        {/* Distance + time chips */}
        <div className="flex gap-2 ml-auto">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {formatMinutes(leg.drivingMinutes)}
          </span>
          <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
            {leg.distanceMiles} mi
          </span>
        </div>
      </div>

      {/* Route notes */}
      {leg.notes && (
        <p className="text-xs text-stone-400 mt-2">{leg.notes}</p>
      )}

      {/* Charging stops */}
      {leg.chargingStops && leg.chargingStops.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {leg.chargingStops.map((stop, i) => {
            const stopPlace = places[stop.placeId];
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-100 text-green-700 px-2 py-1 rounded-full"
              >
                <span>⚡</span>
                <button
                  onClick={() => stopPlace && onPlaceClick(stopPlace)}
                  className="hover:underline font-medium"
                >
                  {stopPlace?.name ?? stop.placeId}
                </button>
                <span className="text-green-500">~{stop.estimatedChargeMinutes} min</span>
                {stop.supercharger && (
                  <span className="bg-green-200 text-green-800 px-1 rounded text-[10px] font-semibold">SC</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
