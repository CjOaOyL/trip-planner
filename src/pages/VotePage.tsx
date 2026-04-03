import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createSession,
  getSession,
  castBallot,
  nextVoter,
  updateSession,
  type VoteSession,
  type VoteOption,
  type VoteParticipant,
} from '../utils/voteSession';
import RankerDnd from '../components/RankerDnd';
import VoteResults from '../components/VoteResults';

// ─── Setup screen ─────────────────────────────────────────────────────────────

const DEFAULT_NAMES = ['Mom', 'Maya', 'Mia', 'Mira', 'Morgan'];

interface SetupProps {
  prefillOptions?: VoteOption[];
  prefillTitle?: string;
  tripId?: string;
  itineraryId?: string;
  onCreated: (session: VoteSession) => void;
}

function SetupScreen({ prefillOptions, prefillTitle, tripId, itineraryId, onCreated }: SetupProps) {
  const [title, setTitle] = useState(prefillTitle ?? '');
  const [context, setContext] = useState('');
  const [participantNames, setParticipantNames] = useState<string[]>(DEFAULT_NAMES);
  const [options, setOptions] = useState<VoteOption[]>(
    prefillOptions ?? [
      { id: `opt-${Date.now()}-0`, label: '' },
      { id: `opt-${Date.now()}-1`, label: '' },
    ],
  );

  function updateName(idx: number, val: string) {
    setParticipantNames((prev) => prev.map((n, i) => (i === idx ? val : n)));
  }

  function addParticipant() {
    setParticipantNames((prev) => [...prev, '']);
  }

  function removeParticipant(idx: number) {
    setParticipantNames((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateOption(idx: number, field: keyof VoteOption, val: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: val } : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, { id: `opt-${Date.now()}-${prev.length}`, label: '' }]);
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function canStart() {
    return (
      title.trim() &&
      participantNames.filter((n) => n.trim()).length >= 1 &&
      options.filter((o) => o.label.trim()).length >= 2
    );
  }

  function handleStart() {
    const participants: VoteParticipant[] = participantNames
      .filter((n) => n.trim())
      .map((name, i) => ({ id: `p${i}`, name: name.trim() }));
    const validOptions = options.filter((o) => o.label.trim());

    const session = createSession({
      title: title.trim(),
      context: context.trim() || undefined,
      options: validOptions,
      participants,
      tripId,
      itineraryId,
    });
    onCreated(session);
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div className="text-center">
        <div className="text-4xl mb-2">🗳</div>
        <h1 className="text-2xl font-bold text-stone-800">New Vote</h1>
        <p className="text-stone-500 text-sm mt-1">Ranked choice · Condorcet winner</p>
      </div>

      {/* Title */}
      <section>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
          What are you voting on?
        </label>
        <input
          className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="e.g. Dinner on Day 3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="mt-2 w-full border border-stone-200 rounded-xl px-4 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Optional context or notes"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </section>

      {/* Options */}
      <section>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
          Options to rank
        </label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={opt.id} className="flex gap-2">
              <input
                className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={`Option ${idx + 1}`}
                value={opt.label}
                onChange={(e) => updateOption(idx, 'label', e.target.value)}
              />
              <textarea
                className="w-48 border border-stone-200 rounded-xl px-3 py-1.5 text-sm text-stone-600 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                placeholder="Description voters will see (2–3 sentences)"
                rows={2}
                value={opt.description ?? ''}
                onChange={(e) => updateOption(idx, 'description', e.target.value)}
              />
              {options.length > 2 && (
                <button
                  onClick={() => removeOption(idx)}
                  className="text-stone-300 hover:text-red-400 px-2 transition-colors"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addOption}
          className="mt-2 text-sm text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          + Add option
        </button>
      </section>

      {/* Participants */}
      <section>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
          Participants ({participantNames.filter((n) => n.trim()).length})
        </label>
        <div className="space-y-2">
          {participantNames.map((name, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={`Participant ${idx + 1}`}
                value={name}
                onChange={(e) => updateName(idx, e.target.value)}
              />
              {participantNames.length > 1 && (
                <button
                  onClick={() => removeParticipant(idx)}
                  className="text-stone-300 hover:text-red-400 px-2 transition-colors"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addParticipant}
          className="mt-2 text-sm text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          + Add participant
        </button>
      </section>

      {/* Start */}
      <button
        onClick={handleStart}
        disabled={!canStart()}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow transition-colors"
      >
        Start Voting →
      </button>
    </div>
  );
}

// ─── Voting screen ────────────────────────────────────────────────────────────

interface VotingProps {
  session: VoteSession;
  onBallotCast: (updated: VoteSession) => void;
}

function VotingScreen({ session, onBallotCast }: VotingProps) {
  const voter = nextVoter(session);
  const total = session.participants.length;
  const done = session.ballots.length;

  if (!voter) return null; // shouldn't happen

  function handleSubmit(ranking: string[]) {
    const updated = castBallot(session.id, {
      participantId: voter!.id,
      ranking,
    });
    if (updated) onBallotCast(updated);
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-stone-400 mb-1">
          <span>{session.title}</span>
          <span>{done}/{total} voted</span>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-1.5">
          <div
            className="bg-indigo-400 h-1.5 rounded-full transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>

        {/* Participant dots */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {session.participants.map((p) => {
            const voted = session.ballots.some((b) => b.participantId === p.id);
            const isCurrent = p.id === voter.id;
            return (
              <span
                key={p.id}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  voted
                    ? 'bg-emerald-100 text-emerald-700'
                    : isCurrent
                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                    : 'bg-stone-100 text-stone-400'
                }`}
              >
                {voted ? '✓ ' : isCurrent ? '→ ' : ''}{p.name}
              </span>
            );
          })}
        </div>
      </div>

      <RankerDnd
        participantName={voter.name}
        options={session.options}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// ─── Main VotePage ────────────────────────────────────────────────────────────

export default function VotePage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<VoteSession | null>(null);

  // Options can be pre-seeded via ?options=JSON in the URL (from itinerary integration)
  const prefillOptions = (() => {
    const raw = searchParams.get('options');
    if (!raw) return undefined;
    try { return JSON.parse(decodeURIComponent(raw)) as VoteOption[]; }
    catch { return undefined; }
  })();
  const prefillTitle = searchParams.get('title') ?? undefined;
  const prefillTripId = searchParams.get('tripId') ?? undefined;
  const prefillItineraryId = searchParams.get('itineraryId') ?? undefined;

  useEffect(() => {
    if (sessionId) {
      const s = getSession(sessionId);
      setSession(s);
    }
  }, [sessionId]);

  function handleCreated(s: VoteSession) {
    setSession(s);
    navigate(`/vote/${s.id}`, { replace: true });
  }

  function handleBallotCast(updated: VoteSession) {
    setSession(updated);
  }

  function handleVoteAgain() {
    if (!session) return;
    // Reset ballots, go back to voting
    const reset: VoteSession = { ...session, ballots: [], status: 'voting' };
    updateSession(reset);
    setSession(reset);
  }

  function handleClose() {
    const tripId = session?.tripId;
    const itinId = session?.itineraryId;
    if (tripId && itinId) navigate(`/trip/${tripId}/itinerary/${itinId}`);
    else if (tripId) navigate(`/trip/${tripId}`);
    else navigate('/');
  }

  // ── Layout shell ──
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <button
          onClick={handleClose}
          className="text-sm text-stone-400 hover:text-stone-700 mb-6 block"
        >
          ← Back
        </button>

        {/* No session yet — show setup */}
        {!session && (
          <SetupScreen
            prefillOptions={prefillOptions}
            prefillTitle={prefillTitle}
            tripId={prefillTripId}
            itineraryId={prefillItineraryId}
            onCreated={handleCreated}
          />
        )}

        {/* Active voting */}
        {session && session.status === 'voting' && (
          <VotingScreen session={session} onBallotCast={handleBallotCast} />
        )}

        {/* Results */}
        {session && session.status === 'results' && (
          <VoteResults
            session={session}
            onVoteAgain={handleVoteAgain}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
