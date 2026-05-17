'use client';

import { useState, useEffect, useCallback } from 'react';
import { Session, Team, Match } from '@/lib/types';

interface Props {
  session: Session;
  onUpdate: (updates: Partial<Session>) => Promise<void>;
}

function useMatchTimer(match: Match | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  if (!match) return { elapsed: 0, remaining: 0, isExpired: false };

  let elapsed = match.elapsedSeconds;
  if (match.startedAt && !match.isPaused && !match.endedAt) {
    elapsed += (now - new Date(match.startedAt).getTime()) / 1000;
  }
  elapsed = Math.min(elapsed, match.timerDuration + 60);

  const remaining = Math.max(0, match.timerDuration - elapsed);
  return { elapsed, remaining, isExpired: remaining === 0 };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MatchTab({ session, onUpdate }: Props) {
  const match = session.currentMatch;
  const { remaining, isExpired } = useMatchTimer(match);
  const [declaring, setDeclaring] = useState(false);

  const teamA = match ? session.teams.find((t) => t.id === match.teamAId) : null;
  const teamB = match ? session.teams.find((t) => t.id === match.teamBId) : null;

  const isRunning = !!match?.startedAt && !match.isPaused && !match.endedAt;
  const isStarted = !!match?.startedAt;

  async function handleStart() {
    if (!match) return;
    const updated: Match = {
      ...match,
      startedAt: new Date().toISOString(),
      isPaused: false,
      pausedAt: null,
    };
    await onUpdate({ currentMatch: updated });
  }

  async function handlePause() {
    if (!match || !match.startedAt) return;
    const elapsed = match.elapsedSeconds + (Date.now() - new Date(match.startedAt).getTime()) / 1000;
    const updated: Match = {
      ...match,
      isPaused: true,
      pausedAt: new Date().toISOString(),
      elapsedSeconds: elapsed,
      startedAt: null,
    };
    await onUpdate({ currentMatch: updated });
  }

  async function handleResume() {
    if (!match) return;
    const updated: Match = {
      ...match,
      startedAt: new Date().toISOString(),
      isPaused: false,
      pausedAt: null,
    };
    await onUpdate({ currentMatch: updated });
  }

  async function handleReset() {
    if (!match) return;
    const updated: Match = {
      ...match,
      startedAt: null,
      isPaused: false,
      pausedAt: null,
      elapsedSeconds: 0,
    };
    await onUpdate({ currentMatch: updated });
  }

  async function adjustScore(side: 'teamA' | 'teamB', delta: number) {
    if (!match) return;
    const newScore = {
      ...match.score,
      [side]: Math.max(0, match.score[side] + delta),
    };
    await onUpdate({ currentMatch: { ...match, score: newScore } });
  }

  async function handleDeclareWinner(winnerId: string) {
    if (!match || declaring) return;
    setDeclaring(true);

    const winnerTeam = session.teams.find((t) => t.id === winnerId)!;
    const loserTeam = session.teams.find((t) => t.id !== winnerId && [match.teamAId, match.teamBId].includes(t.id))!;

    const newConsecWins = winnerTeam.consecutiveWins + 1;
    const winsToRest = session.settings.consecutiveWinsToRest;
    const mustRest = newConsecWins >= winsToRest;

    // Update teams
    const updatedTeams = session.teams.map((team) => {
      if (team.id === winnerId) {
        return {
          ...team,
          consecutiveWins: mustRest ? 0 : newConsecWins,
          isResting: mustRest,
          restRoundsLeft: mustRest ? session.settings.restRounds : 0,
          stats: {
            ...team.stats,
            wins: team.stats.wins + 1,
            gamesPlayed: team.stats.gamesPlayed + 1,
          },
        };
      }
      if (team.id === loserTeam.id) {
        return {
          ...team,
          consecutiveWins: 0,
          stats: {
            ...team.stats,
            losses: team.stats.losses + 1,
            gamesPlayed: team.stats.gamesPlayed + 1,
          },
        };
      }
      return team;
    });

    // Update players stats
    const updatedPlayers = session.players.map((player) => {
      const onWinner = winnerTeam.playerIds.includes(player.id);
      const onLoser = loserTeam.playerIds.includes(player.id);
      if (!onWinner && !onLoser) return player;
      return {
        ...player,
        stats: {
          gamesPlayed: player.stats.gamesPlayed + 1,
          wins: player.stats.wins + (onWinner ? 1 : 0),
        },
      };
    });

    // Completed match record
    const completedMatch: Match = {
      ...match,
      endedAt: new Date().toISOString(),
      winnerId,
    };

    // Build next queue: advance resting teams, add winner (unless resting), loser goes to back
    const updatedTeamsMap = new Map(updatedTeams.map((t) => [t.id, t]));

    // Decrement rest for resting teams
    const processedTeams = updatedTeams.map((t) => {
      if (t.isResting && t.id !== winnerId) {
        const newRest = t.restRoundsLeft - 1;
        return { ...t, restRoundsLeft: newRest, isResting: newRest > 0 };
      }
      return t;
    });

    // Rebuild queue: existing queue + winner (if not resting) + loser at back
    let newQueue = [...session.queue];

    // Winner stays if not resting; goes to front of queue
    const winnerFinal = processedTeams.find((t) => t.id === winnerId)!;
    if (!winnerFinal.isResting) {
      newQueue = [winnerId, ...newQueue];
    }

    // Loser goes to back
    newQueue = [...newQueue, loserTeam.id];

    // Remove teams that just came off rest and add them to queue
    const justCameBack = processedTeams.filter(
      (t) => !t.isResting && updatedTeamsMap.get(t.id)?.isResting && t.id !== winnerId
    );
    newQueue = [...newQueue, ...justCameBack.map((t) => t.id)];

    await onUpdate({
      teams: processedTeams,
      players: updatedPlayers,
      currentMatch: null,
      queue: newQueue,
      completedMatches: [completedMatch, ...session.completedMatches],
    });
    setDeclaring(false);
  }

  if (!match) {
    const nextA = session.queue[0] ? session.teams.find((t) => t.id === session.queue[0]) : null;
    const nextB = session.queue[1] ? session.teams.find((t) => t.id === session.queue[1]) : null;

    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-6xl">⏸</div>
        <div className="text-center">
          <h3 className="text-2xl font-black text-white">No Active Match</h3>
          <p className="text-gray-400 mt-2">
            {session.queue.length >= 2
              ? 'Ready to start — go to Queue tab and tap Start Match'
              : session.teams.length === 0
              ? 'Generate teams in the Queue tab to get started'
              : 'Need at least 2 teams in the queue'}
          </p>
        </div>

        {nextA && nextB && (
          <div className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-400 text-center mb-3">Next up</p>
            <div className="flex items-center justify-center gap-4">
              <span className="font-black text-white text-xl">{nextA.name}</span>
              <span className="text-gray-500 font-bold">VS</span>
              <span className="font-black text-white text-xl">{nextB.name}</span>
            </div>
          </div>
        )}

        {session.completedMatches.length > 0 && (
          <div className="w-full text-center text-gray-500 text-sm">
            {session.completedMatches.length} match{session.completedMatches.length !== 1 ? 'es' : ''} completed today
          </div>
        )}
      </div>
    );
  }

  const timerPct = Math.max(0, remaining / match.timerDuration);
  const timerColor = isExpired
    ? '#ef4444'
    : remaining < 60
    ? '#f97316'
    : '#22c55e';

  return (
    <div className="flex flex-col gap-5">
      {/* Match header */}
      <div className="text-center">
        <p className="text-sm text-gray-400 font-semibold uppercase tracking-wider">
          Match #{session.completedMatches.length + 1}
        </p>
      </div>

      {/* Teams vs display */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-stretch gap-4">
          {/* Team A */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="font-black text-white text-xl text-center">{teamA?.name}</div>
            <div className="text-6xl font-black text-white">{match.score.teamA}</div>
            <div className="flex gap-2">
              <button
                onClick={() => adjustScore('teamA', -1)}
                className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
              >−</button>
              <button
                onClick={() => adjustScore('teamA', 1)}
                className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-bold text-xl flex items-center justify-center transition-colors"
              >+</button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="text-gray-500 font-bold text-lg">VS</div>
            <div className="w-px flex-1 bg-gray-700" />
          </div>

          {/* Team B */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="font-black text-white text-xl text-center">{teamB?.name}</div>
            <div className="text-6xl font-black text-white">{match.score.teamB}</div>
            <div className="flex gap-2">
              <button
                onClick={() => adjustScore('teamB', -1)}
                className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
              >−</button>
              <button
                onClick={() => adjustScore('teamB', 1)}
                className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-bold text-xl flex items-center justify-center transition-colors"
              >+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Timer */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col items-center gap-4">
        <div
          className="text-7xl font-black tabular-nums tracking-tight"
          style={{ color: timerColor }}
        >
          {formatTime(remaining)}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${timerPct * 100}%`, backgroundColor: timerColor }}
          />
        </div>

        {isExpired && (
          <div className="text-red-400 font-bold text-sm animate-pulse">⏰ Time&apos;s up! Declare a winner.</div>
        )}

        {/* Timer controls */}
        <div className="flex gap-2 w-full">
          {!isStarted ? (
            <button
              onClick={handleStart}
              className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold text-lg transition-colors"
            >
              ▶ Start
            </button>
          ) : isRunning ? (
            <button
              onClick={handlePause}
              className="flex-1 py-3 rounded-xl bg-yellow-500/80 hover:bg-yellow-500 text-white font-bold text-lg transition-colors"
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={handleResume}
              className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold text-lg transition-colors"
            >
              ▶ Resume
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold transition-colors"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Declare winner */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider text-center">Declare Winner</p>
        <div className="flex gap-2">
          <button
            onClick={() => teamA && handleDeclareWinner(teamA.id)}
            disabled={declaring}
            className="flex-1 py-4 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black text-lg transition-colors"
          >
            🏆 {teamA?.name}
          </button>
          <button
            onClick={() => teamB && handleDeclareWinner(teamB.id)}
            disabled={declaring}
            className="flex-1 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-black text-lg transition-colors"
          >
            🏆 {teamB?.name}
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center">
          This will update the queue and player stats automatically
        </p>
      </div>
    </div>
  );
}
