import { useState } from 'react';
import type { Day, Place, ReservationStatus } from '../types';
import DayRow from './DayRow';

interface Props {
  days: Day[];
  places: Record<string, Place>;
  onPlaceClick: (place: Place) => void;
  reservationsByPlaceId?: Record<string, ReservationStatus>;
  showCost?: boolean;
  editing?: boolean;
  onUpdateDay?: (dayIndex: number, updated: Day) => void;
  onRemoveDay?: (dayIndex: number) => void;
}

export default function DayTable({ days, places, onPlaceClick, reservationsByPlaceId = {}, showCost, editing, onUpdateDay, onRemoveDay }: Props) {
  const [openDayId, setOpenDayId] = useState<string | null>(days[0]?.id ?? null);

  function toggle(dayId: string) {
    setOpenDayId((prev) => (prev === dayId ? null : dayId));
  }

  return (
    <div className="space-y-2">
      {days.map((day, index) => (
        <DayRow
          key={day.id}
          day={day}
          dayNumber={index + 1}
          places={places}
          isOpen={openDayId === day.id}
          onToggle={() => toggle(day.id)}
          onPlaceClick={onPlaceClick}
          reservationsByPlaceId={reservationsByPlaceId}
          showCost={showCost}
          editing={editing}
          onUpdateDay={onUpdateDay ? (updated: Day) => onUpdateDay(index, updated) : undefined}
          onRemoveDay={onRemoveDay ? () => onRemoveDay(index) : undefined}
        />
      ))}
    </div>
  );
}
