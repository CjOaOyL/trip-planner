import type { PlaceType } from '../types';

export const TYPE_COLOR: Record<PlaceType, string> = {
  university:         '#6366f1',
  restaurant:         '#f97316',
  attraction:         '#14b8a6',
  hotel:              '#a855f7',
  'ski-resort':       '#0ea5e9',
  'charging-station': '#22c55e',
  neighborhood:       '#ec4899',
  museum:             '#f59e0b',
  park:               '#84cc16',
  'concert-venue':    '#8b5cf6',
  airport:            '#64748b',
  beach:              '#06b6d4',
  other:              '#94a3b8',
};

export const TYPE_EMOJI: Record<PlaceType, string> = {
  university:         '🎓',
  restaurant:         '🍽',
  attraction:         '📍',
  hotel:              '🛏',
  'ski-resort':       '⛷',
  'charging-station': '⚡',
  neighborhood:       '🏘',
  museum:             '🏛',
  park:               '🌿',
  'concert-venue':    '🎵',
  airport:            '✈️',
  beach:              '🏖',
  other:              '📌',
};
