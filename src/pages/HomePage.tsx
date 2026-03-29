import { useNavigate } from 'react-router-dom';
import { TRIP_REGISTRY } from '../utils/loadTrip';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-stone-800 mb-2">Trip Planner</h1>
      <p className="text-stone-500 mb-10">Pick a trip to explore itineraries, maps, and reservations.</p>

      <div className="grid gap-4 w-full max-w-md">
        {TRIP_REGISTRY.map((trip) => (
          <button
            key={trip.id}
            onClick={() => navigate(`/trip/${trip.id}`)}
            className="bg-white border border-stone-200 rounded-2xl p-6 text-left shadow-sm hover:shadow-md hover:border-brand-500 transition-all"
          >
            <div className="text-xl font-semibold text-stone-800">{trip.label}</div>
            <div className="text-sm text-stone-400 mt-1">View itineraries →</div>
          </button>
        ))}
      </div>
    </div>
  );
}
