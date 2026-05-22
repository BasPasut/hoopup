import { Player, Team, GameMode } from './types';

type FunctionalGroup = 'GUARD' | 'WING' | 'BIG';

// Map traditional positions → 3 fluid functional groups (small-ball logic)
function getFunctionalGroup(player: Player): FunctionalGroup {
  const primary = player.positions[0];
  if (!primary) return 'WING';
  if (primary === 'PG') return 'GUARD';
  if (primary === 'SG' || primary === 'SF') return 'WING';
  return 'BIG'; // PF and C treated interchangeably
}

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

// One assignment attempt: scarcity-first, skill-balanced distribution.
// When randomize=true, players of equal skill within each functional group are shuffled
// to produce variety across repeat calls (for history-avoidance).
function runAssignment(
  available: Player[],
  numFullTeams: number,
  playersPerTeam: number,
  existingTeamCount: number,
  playerMap: Map<string, Player>,
  randomize: boolean
): Team[] {
  const teams: Team[] = Array.from({ length: numFullTeams }, (_, i) => ({
    id: crypto.randomUUID(),
    name: generateTeamName(existingTeamCount + i),
    playerIds: [],
    consecutiveWins: 0,
    isResting: false,
    restRoundsLeft: 0,
    stats: { wins: 0, losses: 0, gamesPlayed: 0 },
  }));
  const skillSums = new Array<number>(numFullTeams).fill(0);

  // Step 1: Group players into functional buckets
  const groups = new Map<FunctionalGroup, Player[]>([
    ['BIG', []],
    ['WING', []],
    ['GUARD', []],
  ]);
  for (const p of available) {
    groups.get(getFunctionalGroup(p))!.push(p);
  }

  // Step 2: Sort each group skill desc; optionally shuffle within equal-skill tiers
  for (const [, group] of groups) {
    group.sort((a, b) => b.skillLevel - a.skillLevel);
    if (randomize) {
      let i = 0;
      while (i < group.length) {
        let j = i;
        while (j < group.length && group[j].skillLevel === group[i].skillLevel) j++;
        const tier = shuffleArray(group.slice(i, j));
        for (let k = 0; k < tier.length; k++) group[i + k] = tier[k];
        i = j;
      }
    }
  }

  // Step 3: Scarcity-first — rarest functional group (usually BIGs) distributed first
  const scarcityOrder = [...groups.entries()].sort((a, b) => a[1].length - b[1].length);

  // Step 4: Assign each player to the team with the lowest skill sum that has an open spot
  for (const [, group] of scarcityOrder) {
    for (const player of group) {
      let target = -1;
      for (let i = 0; i < numFullTeams; i++) {
        if (teams[i].playerIds.length >= playersPerTeam) continue;
        if (
          target === -1 ||
          skillSums[i] < skillSums[target] ||
          (skillSums[i] === skillSums[target] && teams[i].playerIds.length < teams[target].playerIds.length)
        ) {
          target = i;
        }
      }
      if (target === -1) break; // All roster spots filled
      teams[target].playerIds.push(player.id);
      skillSums[target] += player.skillLevel;
    }
  }

  // Step 5: Optimization pass — swap same-group players between team pairs with gap > 1
  let improved = true;
  while (improved) {
    improved = false;
    outer: for (let i = 0; i < numFullTeams; i++) {
      for (let j = i + 1; j < numFullTeams; j++) {
        const gap = Math.abs(skillSums[i] - skillSums[j]);
        if (gap <= 1) continue;
        for (const pidA of teams[i].playerIds) {
          for (const pidB of teams[j].playerIds) {
            const pA = playerMap.get(pidA);
            const pB = playerMap.get(pidB);
            if (!pA || !pB) continue;
            if (getFunctionalGroup(pA) !== getFunctionalGroup(pB)) continue;
            const newI = skillSums[i] - pA.skillLevel + pB.skillLevel;
            const newJ = skillSums[j] - pB.skillLevel + pA.skillLevel;
            if (Math.abs(newI - newJ) < gap) {
              teams[i].playerIds[teams[i].playerIds.indexOf(pidA)] = pidB;
              teams[j].playerIds[teams[j].playerIds.indexOf(pidB)] = pidA;
              skillSums[i] = newI;
              skillSums[j] = newJ;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
  }

  return teams;
}

// Tries up to 8 shuffles to find a lineup not in teamHistory.
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
  const playerMap = new Map(players.map((p) => [p.id, p]));

  let bestFullTeams: Team[] = [];
  let bestOverlap = Infinity;

  for (let attempt = 0; attempt < 8; attempt++) {
    const fullTeams = runAssignment(
      available, numFullTeams, playersPerTeam, existingTeamCount, playerMap, attempt > 0
    );
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
