import { useEffect } from 'react';
import type { Place } from '../types';

interface Props {
  place: Place | null;
  onClose: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  university:         '🎓',
  restaurant:         '🍽',
  attraction:         '📍',
  hotel:              '🛏',
  'ski-resort':       '⛷',
  'charging-station': '⚡',
  neighborhood:       '🏘',
  museum:             '🏛',
  park:               '🌿',
  other:              '📌',
};

export default function PlacePanel({ place, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${
          place ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          ${place ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {place && <PanelContent place={place} onClose={onClose} />}
      </div>
    </>
  );
}

function PanelContent({ place, onClose }: { place: Place; onClose: () => void }) {
  const emoji = TYPE_EMOJI[place.type] ?? '📌';

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-stone-100">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">{emoji}</span>
          <div>
            <h2 className="text-base font-bold text-stone-800 leading-tight">{place.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-stone-400 capitalize">{place.type.replace('-', ' ')}</span>
              {place.blackOwned && (
                <span className="bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Black-owned
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-stone-400 hover:text-stone-700 text-xl leading-none mt-1"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Photo */}
        {place.photos && place.photos.length > 0 && (
          <div className="w-full h-48 bg-stone-100 overflow-hidden">
            <img
              src={place.photos[0]}
              alt={place.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Description */}
          <p className="text-sm text-stone-600 leading-relaxed">{place.description}</p>

          {/* Address */}
          <div className="flex items-start gap-2 text-sm">
            <span className="text-stone-400 shrink-0 mt-0.5">📍</span>
            <span className="text-stone-600">{place.address}</span>
          </div>

          {/* Tags */}
          {place.tags && place.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <a
              href={place.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              <span>🗺</span> Open in Google Maps
            </a>

            {place.website && (
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                <span>🔗</span> Visit Website
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
