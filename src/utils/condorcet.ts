// ─── Condorcet + Schulze voting math ─────────────────────────────────────────

export interface Ballot {
  participantId: string;
  ranking: string[]; // option IDs, most-preferred first
}

/** pref[a][b] = number of voters who rank a above b */
export type PreferenceMatrix = Record<string, Record<string, number>>;

export interface CondorcetResult {
  winner: string | null;
  method: 'condorcet' | 'schulze' | 'none';
  preferenceMatrix: PreferenceMatrix;
  ranking: string[];           // full ordering, best first
  isTie: boolean;
}

// Build raw pairwise preference counts from ballots
export function buildPreferenceMatrix(
  options: string[],
  ballots: Ballot[],
): PreferenceMatrix {
  const pref: PreferenceMatrix = {};
  for (const a of options) {
    pref[a] = {};
    for (const b of options) pref[a][b] = 0;
  }

  for (const ballot of ballots) {
    for (let i = 0; i < ballot.ranking.length; i++) {
      for (let j = i + 1; j < ballot.ranking.length; j++) {
        const preferred = ballot.ranking[i];
        const other = ballot.ranking[j];
        if (pref[preferred]?.[other] !== undefined) pref[preferred][other]++;
      }
    }
  }
  return pref;
}

// Returns the Condorcet winner (beats every other candidate head-to-head), or null
function findCondorcetWinner(options: string[], pref: PreferenceMatrix): string | null {
  outer: for (const candidate of options) {
    for (const other of options) {
      if (other === candidate) continue;
      if ((pref[candidate]?.[other] ?? 0) <= (pref[other]?.[candidate] ?? 0)) {
        continue outer;
      }
    }
    return candidate;
  }
  return null;
}

// Schulze beatpath method — Floyd-Warshall on strongest paths
function schulzeRanking(options: string[], pref: PreferenceMatrix): string[] {
  // strength[i][j] = strength of strongest path from i to j
  const s: PreferenceMatrix = {};
  for (const a of options) {
    s[a] = {};
    for (const b of options) {
      if (a === b) { s[a][b] = 0; continue; }
      const ab = pref[a]?.[b] ?? 0;
      const ba = pref[b]?.[a] ?? 0;
      s[a][b] = ab > ba ? ab : 0;
    }
  }

  for (const k of options) {
    for (const i of options) {
      if (i === k) continue;
      for (const j of options) {
        if (j === k || j === i) continue;
        const via = Math.min(s[i]?.[k] ?? 0, s[k]?.[j] ?? 0);
        if (via > (s[i]?.[j] ?? 0)) s[i][j] = via;
      }
    }
  }

  // Rank by number of candidates each beats via beatpath
  return [...options].sort((a, b) => {
    let aWins = 0, bWins = 0;
    for (const other of options) {
      if (other !== a && (s[a]?.[other] ?? 0) > (s[other]?.[a] ?? 0)) aWins++;
      if (other !== b && (s[b]?.[other] ?? 0) > (s[other]?.[b] ?? 0)) bWins++;
    }
    return bWins - aWins;
  });
}

export function computeResult(options: string[], ballots: Ballot[]): CondorcetResult {
  if (options.length === 0 || ballots.length === 0) {
    return { winner: null, method: 'none', preferenceMatrix: {}, ranking: options, isTie: false };
  }

  const pref = buildPreferenceMatrix(options, ballots);
  const condorcetWinner = findCondorcetWinner(options, pref);

  if (condorcetWinner) {
    const rest = options.filter((o) => o !== condorcetWinner);
    return {
      winner: condorcetWinner,
      method: 'condorcet',
      preferenceMatrix: pref,
      ranking: [condorcetWinner, ...rest],
      isTie: false,
    };
  }

  const ranking = schulzeRanking(options, pref);
  // Check for tie at the top
  const topWins = countBeatpathWins(ranking[0], options, pref);
  const secondWins = ranking[1] ? countBeatpathWins(ranking[1], options, pref) : -1;
  const isTie = topWins === secondWins;

  return {
    winner: isTie ? null : (ranking[0] ?? null),
    method: 'schulze',
    preferenceMatrix: pref,
    ranking,
    isTie,
  };
}

function countBeatpathWins(candidate: string, options: string[], pref: PreferenceMatrix): number {
  let wins = 0;
  for (const other of options) {
    if (other !== candidate && (pref[candidate]?.[other] ?? 0) > (pref[other]?.[candidate] ?? 0)) {
      wins++;
    }
  }
  return wins;
}
