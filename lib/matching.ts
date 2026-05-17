import { Player, Team, GameMode } from './types';

function generateTeamName(index: number): string {
  const names = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F', 'Team G', 'Team H'];
  return names[index] ?? `Team ${index + 1}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function compositionKey(playerIds: string[]): string {
  return [...playerIds].sort().join(',');
}

// Snake-draft by skill level, with randomization within skill groups to prevent repeated lineups.
// Tries up to 8 shuffles to find a combination not in teamHistory.
export function createBalancedTeams(
  players: Player[],
  gameMode: GameMode,
  existingTeamCount: number = 0,
  teamHistory: string[][] = []
): Team[] {
  const playersPerTeam = parseInt(gameMode[0]);
  const available = players.filter((p) => p.isAvailable);
  const numTeams = Math.floor(available.length / playersPerTeam);

  if (numTeams < 2) return [];

  const historyKeys = new Set(teamHistory.map(compositionKey));
  const ballHandlers = new Set<string>(['PG', 'SG']);

  // Group players by skill level for intra-group shuffling
  const bySkill = new Map<number, Player[]>();
  for (const p of available) {
    if (!bySkill.has(p.skillLevel)) bySkill.set(p.skillLevel, []);
    bySkill.get(p.skillLevel)!.push(p);
  }
  const skillLevels = [...bySkill.keys()].sort((a, b) => b - a);

  let bestTeams: Team[] = [];
  let bestOverlap = Infinity;

  for (let attempt = 0; attempt < 8; attempt++) {
    const sorted: Player[] = [];

    for (const skill of skillLevels) {
      const group = bySkill.get(skill)!;
      let ordered: Player[];

      if (attempt === 0) {
        // First attempt: ball-handlers first (original balanced behavior)
        const bh = group.filter((p) => p.positions.some((pos) => ballHandlers.has(pos)));
        const rest = group.filter((p) => !p.positions.some((pos) => ballHandlers.has(pos)));
        ordered = [...shuffleArray(bh), ...shuffleArray(rest)];
      } else {
        ordered = shuffleArray(group);
      }

      sorted.push(...ordered);
    }

    const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
      id: crypto.randomUUID(),
      name: generateTeamName(existingTeamCount + i),
      playerIds: [],
      consecutiveWins: 0,
      isResting: false,
      restRoundsLeft: 0,
      stats: { wins: 0, losses: 0, gamesPlayed: 0 },
    }));

    // Snake draft
    const draftPool = sorted.slice(0, numTeams * playersPerTeam);
    draftPool.forEach((player, index) => {
      const round = Math.floor(index / numTeams);
      const posInRound = index % numTeams;
      const teamIndex = round % 2 === 0 ? posInRound : numTeams - 1 - posInRound;
      teams[teamIndex].playerIds.push(player.id);
    });

    const overlap = teams.filter((t) => historyKeys.has(compositionKey(t.playerIds))).length;

    if (overlap === 0) return teams;

    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestTeams = teams;
    }
  }

  return bestTeams.length > 0 ? bestTeams : [];
}

// Returns the sorted playerIds for each team — used to update teamHistory after generation.
export function extractTeamCompositions(teams: Team[]): string[][] {
  return teams.map((t) => [...t.playerIds].sort());
}

export function computeTeamSkill(team: Team, players: Player[]): number {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const total = team.playerIds.reduce((sum, id) => {
    return sum + (playerMap.get(id)?.skillLevel ?? 3);
  }, 0);
  return total;
}

export function getPositionColor(pos: string): string {
  const colors: Record<string, string> = {
    PG: 'bg-blue-500',
    SG: 'bg-purple-500',
    SF: 'bg-green-500',
    PF: 'bg-orange-500',
    C: 'bg-red-500',
  };
  return colors[pos] ?? 'bg-gray-500';
}

export function getPositionLabel(pos: string): string {
  const labels: Record<string, string> = {
    PG: 'Point Guard',
    SG: 'Shooting Guard',
    SF: 'Small Forward',
    PF: 'Power Forward',
    C: 'Center',
  };
  return labels[pos] ?? pos;
}
