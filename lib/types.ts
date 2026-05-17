export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type GameMode = '3v3' | '4v4' | '5v5';
export type TournamentType = 'king-of-court' | 'round-robin' | 'elimination';
export type SessionStatus = 'setup' | 'active' | 'completed';

export interface Player {
  id: string;
  name: string;
  positions: Position[];
  skillLevel: number; // 1–5
  isAvailable: boolean;
  stats: {
    gamesPlayed: number;
    wins: number;
  };
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
  consecutiveWins: number;
  isResting: boolean;
  restRoundsLeft: number;
  stats: {
    wins: number;
    losses: number;
    gamesPlayed: number;
  };
}

export interface Match {
  id: string;
  teamAId: string;
  teamBId: string;
  startedAt: string | null;
  endedAt: string | null;
  timerDuration: number; // seconds
  isPaused: boolean;
  pausedAt: string | null;
  elapsedSeconds: number; // accumulated before pause
  score: { teamA: number; teamB: number };
  winnerId: string | null;
  round: number;
}

export interface SessionSettings {
  gameMode: GameMode;
  tournamentType: TournamentType;
  timerDuration: number; // seconds, default 480 (8 min)
  consecutiveWinsToRest: number; // default 2
  restRounds: number; // default 1
  sessionName: string;
}

export interface Session {
  id: string;
  code: string; // 6-char uppercase
  createdAt: string;
  date: string; // YYYY-MM-DD
  settings: SessionSettings;
  players: Player[];
  teams: Team[];
  queue: string[]; // ordered team IDs waiting to play
  currentMatch: Match | null;
  completedMatches: Match[];
  status: SessionStatus;
  updatedAt: string;
  // sorted playerIds arrays from past team generations — used to avoid duplicate lineups
  teamHistory: string[][];
}

export interface PlayerStats {
  player: Player;
  wins: number;
  gamesPlayed: number;
  winRate: number;
}
