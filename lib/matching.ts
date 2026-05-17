import { Player, Team, GameMode } from './types';

function generateTeamName(index: number): string {
  const names = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F', 'Team G', 'Team H'];
  return names[index] ?? `Team ${index + 1}`;
}

// Snake-draft by skill level, with position-aware first pick per team
export function createBalancedTeams(
  players: Player[],
  gameMode: GameMode,
  existingTeamCount: number = 0
): Team[] {
  const playersPerTeam = parseInt(gameMode[0]);
  const available = players.filter((p) => p.isAvailable);
  const numTeams = Math.floor(available.length / playersPerTeam);

  if (numTeams < 2) return [];

  // Sort by skill descending; tiebreak: PG/SG first (ball-handlers)
  const ballHandlers = new Set<string>(['PG', 'SG']);
  const sorted = [...available].sort((a, b) => {
    if (b.skillLevel !== a.skillLevel) return b.skillLevel - a.skillLevel;
    const aHasBH = a.positions.some((p) => ballHandlers.has(p)) ? 1 : 0;
    const bHasBH = b.positions.some((p) => ballHandlers.has(p)) ? 1 : 0;
    return bHasBH - aHasBH;
  });

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

  return teams;
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
