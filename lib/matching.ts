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
// Remainder players (when count doesn't divide evenly) are grouped into their own undersized team.
export function createBalancedTeams(
  players: Player[],
  gameMode: GameMode,
  existingTeamCount: number = 0,
  teamHistory: string[][] = []
): Team[] {
  const playersPerTeam = parseInt(gameMode[0]);
  const available = players.filter((p) => p.isAvailable);
  const numFullTeams = Math.floor(available.length / playersPerTeam);

  if (numFullTeams < 2) return [];

  const historyKeys = new Set(teamHistory.map(compositionKey));
  const ballHandlers = new Set<string>(['PG', 'SG']);

  const bySkill = new Map<number, Player[]>();
  for (const p of available) {
    if (!bySkill.has(p.skillLevel)) bySkill.set(p.skillLevel, []);
    bySkill.get(p.skillLevel)!.push(p);
  }
  const skillLevels = [...bySkill.keys()].sort((a, b) => b - a);

  let bestFullTeams: Team[] = [];
  let bestOverlap = Infinity;

  for (let attempt = 0; attempt < 8; attempt++) {
    const sorted: Player[] = [];

    for (const skill of skillLevels) {
      const group = bySkill.get(skill)!;
      let ordered: Player[];

      if (attempt === 0) {
        const bh   = group.filter((p) =>  p.positions.some((pos) => ballHandlers.has(pos)));
        const rest = group.filter((p) => !p.positions.some((pos) => ballHandlers.has(pos)));
        ordered = [...shuffleArray(bh), ...shuffleArray(rest)];
      } else {
        ordered = shuffleArray(group);
      }

      sorted.push(...ordered);
    }

    const fullTeams: Team[] = Array.from({ length: numFullTeams }, (_, i) => ({
      id: crypto.randomUUID(),
      name: generateTeamName(existingTeamCount + i),
      playerIds: [],
      consecutiveWins: 0,
      isResting: false,
      restRoundsLeft: 0,
      stats: { wins: 0, losses: 0, gamesPlayed: 0 },
    }));

    // Snake draft for full teams only
    const draftPool = sorted.slice(0, numFullTeams * playersPerTeam);
    draftPool.forEach((player, index) => {
      const round       = Math.floor(index / numFullTeams);
      const posInRound  = index % numFullTeams;
      const teamIndex   = round % 2 === 0 ? posInRound : numFullTeams - 1 - posInRound;
      fullTeams[teamIndex].playerIds.push(player.id);
    });

    const overlap = fullTeams.filter((t) => historyKeys.has(compositionKey(t.playerIds))).length;

    if (overlap === 0) {
      bestFullTeams = fullTeams;
      break;
    }

    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestFullTeams = fullTeams;
    }
  }

  if (bestFullTeams.length === 0) return [];

  // Build remainder team from players not assigned to any full team
  const assignedIds = new Set(bestFullTeams.flatMap((t) => t.playerIds));
  const remainderPlayers = available.filter((p) => !assignedIds.has(p.id));

  if (remainderPlayers.length > 0) {
    bestFullTeams.push({
      id: crypto.randomUUID(),
      name: generateTeamName(existingTeamCount + bestFullTeams.length),
      playerIds: remainderPlayers.map((p) => p.id),
      consecutiveWins: 0,
      isResting: false,
      restRoundsLeft: 0,
      stats: { wins: 0, losses: 0, gamesPlayed: 0 },
    });
  }

  return bestFullTeams;
}

export function extractTeamCompositions(teams: Team[]): string[][] {
  return teams.map((t) => [...t.playerIds].sort());
}

export function computeTeamSkill(team: Team, players: Player[]): number {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  return team.playerIds.reduce((sum, id) => sum + (playerMap.get(id)?.skillLevel ?? 3), 0);
}

export function getPositionColor(pos: string): string {
  const colors: Record<string, string> = {
    PG: 'bg-blue-500', SG: 'bg-purple-500', SF: 'bg-green-500', PF: 'bg-orange-500', C: 'bg-red-500',
  };
  return colors[pos] ?? 'bg-gray-500';
}

export function getPositionLabel(pos: string): string {
  const labels: Record<string, string> = {
    PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center',
  };
  return labels[pos] ?? pos;
}
