import type { Ballot } from './condorcet';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoteOption {
  id: string;
  label: string;
  description?: string;
  // Optional links back into trip data
  placeId?: string;
  itineraryId?: string;
  dayIndex?: number;
  slotKey?: string;
}

export interface VoteParticipant {
  id: string;
  name: string;
}

export type VoteSessionStatus = 'voting' | 'results';

export interface VoteSession {
  id: string;
  title: string;
  context?: string;           // e.g. "Dinner on Day 3 — which restaurant?"
  options: VoteOption[];
  participants: VoteParticipant[];
  ballots: Ballot[];
  status: VoteSessionStatus;
  createdAt: string;
  tripId?: string;
  itineraryId?: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORE_KEY = 'vote-sessions';

function loadAll(): Record<string, VoteSession> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveAll(store: Record<string, VoteSession>) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createSession(
  data: Omit<VoteSession, 'id' | 'createdAt' | 'ballots' | 'status'>,
): VoteSession {
  const session: VoteSession = {
    ...data,
    id: `vote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ballots: [],
    status: 'voting',
    createdAt: new Date().toISOString(),
  };
  const store = loadAll();
  store[session.id] = session;
  saveAll(store);
  return session;
}

export function getSession(id: string): VoteSession | null {
  return loadAll()[id] ?? null;
}

export function updateSession(session: VoteSession): void {
  const store = loadAll();
  store[session.id] = session;
  saveAll(store);
}

export function deleteSession(id: string): void {
  const store = loadAll();
  delete store[id];
  saveAll(store);
}

export function listSessions(tripId?: string): VoteSession[] {
  const all = Object.values(loadAll()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return tripId ? all.filter((s) => s.tripId === tripId) : all;
}

/** Cast or replace a ballot for one participant. Auto-closes session when all have voted. */
export function castBallot(sessionId: string, ballot: Ballot): VoteSession | null {
  const store = loadAll();
  const session = store[sessionId];
  if (!session) return null;

  // Replace existing ballot for this participant
  session.ballots = session.ballots.filter((b) => b.participantId !== ballot.participantId);
  session.ballots.push(ballot);

  if (session.ballots.length >= session.participants.length) {
    session.status = 'results';
  }

  store[sessionId] = session;
  saveAll(store);
  return session;
}

/** Returns the next participant who hasn't voted yet, or null if all have voted. */
export function nextVoter(session: VoteSession): VoteParticipant | null {
  const voted = new Set(session.ballots.map((b) => b.participantId));
  return session.participants.find((p) => !voted.has(p.id)) ?? null;
}
