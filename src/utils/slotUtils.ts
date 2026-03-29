import type { TimeSlot, Segment, PlaceType } from '../types';

function parseHour(time: string): number {
  const match = time.match(/(\d+)(?::\d+)?\s*(AM|PM)/i);
  if (!match) return 12;
  let h = parseInt(match[1], 10);
  const ampm = match[2].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h;
}

/**
 * Infers a TimeSlot from segment time, activity text, and optional place type.
 * No JSON changes required — works on existing data.
 */
export function inferSlot(segment: Segment, placeType?: PlaceType): TimeSlot {
  const act = segment.activity.toLowerCase();
  const h = parseHour(segment.time);

  // Explicit travel markers
  if (
    act.includes('depart') ||
    act.includes('drive') ||
    act.includes('charge') ||
    act.includes('border crossing') ||
    placeType === 'charging-station'
  ) return 'travel';

  // Explicit meal markers
  if (act.includes('breakfast') || act.includes('pastry') || act.includes('coffee') && h < 11)
    return 'breakfast';
  if (act.includes('lunch') || act.includes('brunch')) return 'lunch';
  if (act.includes('dinner') || act.includes('supper') || act.includes('eat') && h >= 17)
    return 'dinner';

  // Time-based fallback
  if (h >= 6 && h < 10) return 'breakfast';
  if (h >= 10 && h < 12) return 'morning';
  if (h >= 12 && h < 14) return 'lunch';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 21) return 'dinner';
  return 'evening';
}

export const SLOT_ORDER: TimeSlot[] = [
  'travel', 'breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening',
];

export const SLOT_LABEL: Record<TimeSlot, string> = {
  travel:    '🚗 Travel',
  breakfast: '☕ Breakfast',
  morning:   '🌅 Morning',
  lunch:     '🥗 Lunch',
  afternoon: '☀️ Afternoon',
  dinner:    '🍽 Dinner',
  evening:   '🌙 Evening',
};

export const SLOT_BG: Record<TimeSlot, string> = {
  travel:    'bg-slate-50',
  breakfast: 'bg-amber-50',
  morning:   'bg-sky-50',
  lunch:     'bg-lime-50',
  afternoon: 'bg-blue-50',
  dinner:    'bg-orange-50',
  evening:   'bg-purple-50',
};
