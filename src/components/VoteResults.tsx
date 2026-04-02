import { useMemo } from 'react';
import { computeResult } from '../utils/condorcet';
import type { VoteSession, VoteOption } from '../utils/voteSession';

interface Props {
  session: VoteSession;
  onVoteAgain: () => void;
  onClose: () => void;
}

const METHOD_LABEL = {
  condorcet: 'Condorcet winner — beats every other option head-to-head',
  schulze:   'Schulze winner — strongest pairwise preference path',
  none:      'No votes recorded',
};

const MEDAL = ['🥇', '🥈', '🥉'];

function optionById(options: VoteOption[], id: string): VoteOption | undefined {
  return options.find((o) => o.id === id);
}

export default function VoteResults({ session, onVoteAgain, onClose }: Props) {
  const optionIds = session.options.map((o) => o.id);
  const result = useMemo(
    () => computeResult(optionIds, session.ballots),
    [session],
  );

  const pref = result.preferenceMatrix;
  const n = session.participants.length;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* ── Winner banner ── */}
      <div className="text-center">
        {result.winner ? (
          <>
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-2xl font-bold text-stone-800">
              {optionById(session.options, result.winner)?.label ?? result.winner}
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {METHOD_LABEL[result.method]}
            </p>
          </>
        ) : result.isTie ? (
          <>
            <div className="text-5xl mb-3">🤝</div>
            <h2 className="text-xl font-bold text-stone-700">It's a tie!</h2>
            <p className="text-sm text-stone-500 mt-1">No single winner emerged — see rankings below</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">🗳</div>
            <h2 className="text-xl font-bold text-stone-700">No votes yet</h2>
          </>
        )}
      </div>

      {/* ── Full ranking ── */}
      {result.ranking.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
            Full Ranking
          </h3>
          <ol className="space-y-2">
            {result.ranking.map((id, idx) => {
              const opt = optionById(session.options, id);
              return (
                <li
                  key={id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    idx === 0 && result.winner
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-stone-200'
                  }`}
                >
                  <span className="text-xl w-8 text-center">{MEDAL[idx] ?? `${idx + 1}.`}</span>
                  <div className="flex-1">
                    <p className="font-medium text-stone-800">{opt?.label ?? id}</p>
                    {opt?.description && (
                      <p className="text-xs text-stone-400">{opt.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* ── Head-to-head matrix ── */}
      {optionIds.length > 1 && session.ballots.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
            Head-to-Head Results <span className="normal-case font-normal">(row beats column by N/{n} voters)</span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="text-sm w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-3 py-2 text-left text-stone-500 font-medium w-32"></th>
                  {session.options.map((opt) => (
                    <th key={opt.id} className="px-2 py-2 text-center text-stone-600 font-medium max-w-[80px]">
                      <span className="block truncate" title={opt.label}>{opt.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {session.options.map((rowOpt) => (
                  <tr key={rowOpt.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2 font-medium text-stone-700 truncate max-w-[128px]" title={rowOpt.label}>
                      {rowOpt.label}
                    </td>
                    {session.options.map((colOpt) => {
                      if (rowOpt.id === colOpt.id) {
                        return (
                          <td key={colOpt.id} className="px-2 py-2 text-center text-stone-300">—</td>
                        );
                      }
                      const wins = pref[rowOpt.id]?.[colOpt.id] ?? 0;
                      const loses = pref[colOpt.id]?.[rowOpt.id] ?? 0;
                      const rowWins = wins > loses;
                      return (
                        <td
                          key={colOpt.id}
                          className={`px-2 py-2 text-center font-semibold ${
                            rowWins ? 'text-emerald-600' : wins === loses ? 'text-stone-400' : 'text-red-400'
                          }`}
                        >
                          {wins}–{loses}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Green = row won, red = row lost, gray = tied
          </p>
        </div>
      )}

      {/* ── Participant breakdown ── */}
      {session.ballots.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
            Individual Rankings
          </h3>
          <div className="space-y-2">
            {session.participants.map((p) => {
              const ballot = session.ballots.find((b) => b.participantId === p.id);
              return (
                <div key={p.id} className="bg-white border border-stone-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-stone-500 mb-1">{p.name}</p>
                  {ballot ? (
                    <ol className="flex flex-wrap gap-1.5">
                      {ballot.ranking.map((id, idx) => {
                        const opt = optionById(session.options, id);
                        return (
                          <li key={id} className="flex items-center gap-1 text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">
                            <span className="text-stone-400">{idx + 1}.</span>
                            {opt?.label ?? id}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="text-xs text-stone-400 italic">Did not vote</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-center flex-wrap pb-4">
        <button
          onClick={onVoteAgain}
          className="px-5 py-2 border border-stone-300 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors text-sm font-medium"
        >
          Vote Again
        </button>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-sm font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}
