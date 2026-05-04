import { useEffect, useState } from 'react';
import { importReservations, type ImportSummary } from '../utils/reservations';

interface Props {
  tripId: string;
  onSave: () => void;
  onClose: () => void;
}

export default function ImportReservationsModal({ tripId, onSave, onClose }: Props) {
  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleImport() {
    setError(null);
    try {
      const result = importReservations(tripId, json);
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  function handleDone() {
    onSave();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <h2 className="font-bold text-stone-800">Import Reservations</h2>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!summary && (
              <>
                <p className="text-sm text-stone-600 mb-3">
                  Paste a reservations JSON payload below. Empty fields will be filled in;
                  values you've already set are preserved. Reservations and options are matched
                  by <span className="font-mono text-xs">id</span>.
                </p>
                <textarea
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  placeholder='[ { "id": "...", "name": "...", "options": [...] } ]'
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
                />
                {error && (
                  <p className="text-xs text-red-600 mt-2">{error}</p>
                )}
              </>
            )}

            {summary && (
              <div className="space-y-3">
                <div className="text-2xl">✓</div>
                <h3 className="font-semibold text-stone-800">Import complete</h3>
                <ul className="text-sm text-stone-600 space-y-1">
                  <li>Reservations added: <span className="font-semibold text-stone-800">{summary.reservationsAdded}</span></li>
                  <li>Reservations with new fields filled: <span className="font-semibold text-stone-800">{summary.reservationsUpdated}</span></li>
                  <li>Options added: <span className="font-semibold text-stone-800">{summary.optionsAdded}</span></li>
                  <li>Options with new fields filled: <span className="font-semibold text-stone-800">{summary.optionsUpdated}</span></li>
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-stone-100">
            {!summary ? (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 border border-stone-200 text-stone-600 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!json.trim()}
                  className="flex-1 bg-stone-800 hover:bg-stone-700 disabled:bg-stone-300 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                >
                  Import
                </button>
              </>
            ) : (
              <button
                onClick={handleDone}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
