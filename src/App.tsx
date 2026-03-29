import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TripPage from './pages/TripPage';
import ItineraryPage from './pages/ItineraryPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip/:tripId" element={<TripPage />} />
        <Route path="/trip/:tripId/itinerary/:itineraryId" element={<ItineraryPage />} />
      </Routes>
    </HashRouter>
  );
}
