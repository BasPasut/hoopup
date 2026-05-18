'use client';

import { useState, useEffect } from 'react';
import { Session, Match } from '@/lib/types';

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
    await onUpdate({ currentMatch: { ...match, startedAt: new Date().toISOString(), isPaused: false, pausedAt: null } });
  }

  async function handlePause() {
    if (!match?.startedAt) return;
    const elapsed = match.elapsedSeconds + (Date.now() - new Date(match.startedAt).getTime()) / 1000;
    await onUpdate({ currentMatch: { ...match, isPaused: true, pausedAt: new Date().toISOString(), elapsedSeconds: elapsed, startedAt: null } });
  }

  async function handleResume() {
    if (!match) return;
    await onUpdate({ currentMatch: { ...match, startedAt: new Date().toISOString(), isPaused: false, pausedAt: null } });
  }

  async function handleReset() {
    if (!match) return;
    await onUpdate({ currentMatch: { ...match, startedAt: null, isPaused: false, pausedAt: null, elapsedSeconds: 0 } });
  }

  async function adjustScore(side: 'teamA' | 'teamB', delta: number) {
    if (!match) return;
    await onUpdate({ currentMatch: { ...match, score: { ...match.score, [side]: Math.max(0, match.score[side] + delta) } } });
  }

  async function handleDeclareWinner(winnerId: string) {
    if (!match || declaring) return;
    setDeclaring(true);

    const winnerTeam = session.teams.find((t) => t.id === winnerId)!;
    const loserTeam  = session.teams.find((t) => t.id !== winnerId && [match.teamAId, match.teamBId].includes(t.id))!;

    const newConsecWins = winnerTeam.consecutiveWins + 1;
    const winsToRest = session.settings.consecutiveWinsToRest;
    const mustRest = newConsecWins >= winsToRest;

    const updatedTeams = session.teams.map((team) => {
      if (team.id === winnerId) return { ...team, consecutiveWins: mustRest ? 0 : newConsecWins, isResting: mustRest, restRoundsLeft: mustRest ? session.settings.restRounds : 0, stats: { ...team.stats, wins: team.stats.wins + 1, gamesPlayed: team.stats.gamesPlayed + 1 } };
      if (team.id === loserTeam.id) return { ...team, consecutiveWins: 0, stats: { ...team.stats, losses: team.stats.losses + 1, gamesPlayed: team.stats.gamesPlayed + 1 } };
      return team;
    });

    const updatedPlayers = session.players.map((player) => {
      const onWinner = winnerTeam.playerIds.includes(player.id);
      const onLoser  = loserTeam.playerIds.includes(player.id);
      if (!onWinner && !onLoser) return player;
      return { ...player, stats: { gamesPlayed: player.stats.gamesPlayed + 1, wins: player.stats.wins + (onWinner ? 1 : 0) } };
    });

    const completedMatch: Match = { ...match, endedAt: new Date().toISOString(), winnerId };
    const updatedTeamsMap = new Map(updatedTeams.map((t) => [t.id, t]));

    const processedTeams = updatedTeams.map((t) => {
      if (t.isResting && t.id !== winnerId) { const newRest = t.restRoundsLeft - 1; return { ...t, restRoundsLeft: newRest, isResting: newRest > 0 }; }
      return t;
    });

    let newQueue = [...session.queue];
    const winnerFinal = processedTeams.find((t) => t.id === winnerId)!;
    if (!winnerFinal.isResting) newQueue = [winnerId, ...newQueue];
    newQueue = [...newQueue, loserTeam.id];
    const justCameBack = processedTeams.filter((t) => !t.isResting && updatedTeamsMap.get(t.id)?.isResting && t.id !== winnerId);
    newQueue = [...newQueue, ...justCameBack.map((t) => t.id)];

    await onUpdate({ teams: processedTeams, players: updatedPlayers, currentMatch: null, queue: newQueue, completedMatches: [completedMatch, ...session.completedMatches] });
    setDeclaring(false);
  }

  /* ── No active match ── */
  if (!match) {
    const nextA = session.queue[0] ? session.teams.find((t) => t.id === session.queue[0]) : null;
    const nextB = session.queue[1] ? session.teams.find((t) => t.id === session.queue[1]) : null;
    const isEnded = session.status === 'completed';

    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          {isEnded ? '🏁' : '⏸'}
        </div>
        <div className="text-center">
          <h3 className="font-display text-3xl tracking-widest text-white">
            {isEnded ? 'Session Ended' : 'No Active Match'}
          </h3>
          <p className="text-sm mt-2 leading-relaxed max-w-xs mx-auto" style={{ color: '#8892A4' }}>
            {isEnded
              ? 'Great games today! Check the Stats tab for final standings.'
              : session.queue.length >= 2
              ? 'Ready to start — go to Queue tab and tap Start Match'
              : session.teams.length === 0
              ? 'Generate teams in the Queue tab to get started'
              : 'Need at least 2 teams in the queue'}
          </p>
        </div>

        {nextA && nextB && !isEnded && (
          <div className="w-full rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <p className="text-[10px] font-bold tracking-widest uppercase text-center mb-4" style={{ color: '#3D4557' }}>Next Up</p>
            <div className="flex items-center justify-center gap-4">
              <span className="font-display text-2xl tracking-widest text-white">{nextA.name}</span>
              <span className="text-xs font-bold tracking-widest" style={{ color: '#3D4557' }}>VS</span>
              <span className="font-display text-2xl tracking-widest text-white">{nextB.name}</span>
            </div>
          </div>
        )}

        {session.completedMatches.length > 0 && (
          <p className="text-xs" style={{ color: '#3D4557' }}>
            {session.completedMatches.length} match{session.completedMatches.length !== 1 ? 'es' : ''} completed today
          </p>
        )}
      </div>
    );
  }

  /* ── Active match ── */
  const timerPct = Math.max(0, remaining / match.timerDuration);
  const timerColor = isExpired ? '#EF4444' : remaining < 60 ? '#FF6B00' : '#22C55E';
  const aLeading = match.score.teamA > match.score.teamB;
  const bLeading = match.score.teamB > match.score.teamA;

  return (
    <div className="flex flex-col gap-4">
      {/* Match number */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: '0 0 6px #22c55e' }} />
          <span className="text-xs font-bold tracking-widest uppercase text-green-400">Live</span>
        </div>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>
          Match #{session.completedMatches.length + 1}
        </span>
      </div>

      {/* Scoreboard */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
        {/* Timer bar */}
        <div className="px-5 pt-5 pb-3">
          <div
            className="font-display text-7xl text-center tabular-nums leading-none mb-3"
            style={{ color: timerColor, textShadow: isExpired ? '0 0 24px rgba(239,68,68,0.4)' : 'none' }}
          >
            {formatTime(remaining)}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${timerPct * 100}%`, background: timerColor }}
            />
          </div>
          {isExpired && (
            <p className="text-center text-xs font-bold mt-2 animate-pulse" style={{ color: timerColor }}>
              ⏰ Time&apos;s up! Declare a winner.
            </p>
          )}
        </div>

        {/* Teams & scores */}
        <div className="grid grid-cols-3 items-center px-5 py-4 gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Team A */}
          <div className="flex flex-col items-center gap-2">
            <p className="font-display text-xl tracking-wide text-white text-center leading-none">{teamA?.name}</p>
            <p
              className="font-display text-6xl leading-none tabular-nums"
              style={{ color: aLeading ? 'var(--orange)' : '#fff', textShadow: aLeading ? '0 0 24px rgba(255,107,0,0.35)' : 'none' }}
            >
              {match.score.teamA}
            </p>
            <div className="flex gap-1.5">
              <ScoreBtn onClick={() => adjustScore('teamA', -1)} color="#1E2433">−</ScoreBtn>
              <ScoreBtn onClick={() => adjustScore('teamA', +1)} color="var(--orange)">+</ScoreBtn>
            </div>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-black tracking-widest" style={{ color: '#3D4557' }}>VS</span>
            <div className="w-px flex-1" style={{ background: 'var(--border)', minHeight: '40px' }} />
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-2">
            <p className="font-display text-xl tracking-wide text-white text-center leading-none">{teamB?.name}</p>
            <p
              className="font-display text-6xl leading-none tabular-nums"
              style={{ color: bLeading ? '#60A5FA' : '#fff', textShadow: bLeading ? '0 0 24px rgba(59,130,246,0.35)' : 'none' }}
            >
              {match.score.teamB}
            </p>
            <div className="flex gap-1.5">
              <ScoreBtn onClick={() => adjustScore('teamB', -1)} color="#1E2433">−</ScoreBtn>
              <ScoreBtn onClick={() => adjustScore('teamB', +1)} color="#3B82F6">+</ScoreBtn>
            </div>
          </div>
        </div>

        {/* Timer controls */}
        <div className="flex gap-2 px-5 pb-5">
          {!isStarted ? (
            <button
              onClick={handleStart}
              className="flex-1 py-3 rounded-xl font-bold text-base text-white uppercase tracking-wide transition-all"
              style={{ background: '#22C55E', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}
            >
              ▶ Start
            </button>
          ) : isRunning ? (
            <button
              onClick={handlePause}
              className="flex-1 py-3 rounded-xl font-bold text-base text-white uppercase tracking-wide transition-all"
              style={{ background: 'rgba(234,179,8,0.8)' }}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={handleResume}
              className="flex-1 py-3 rounded-xl font-bold text-base text-white uppercase tracking-wide transition-all"
              style={{ background: '#22C55E', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}
            >
              ▶ Resume
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-xl font-bold text-base transition-all"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}
          >
            ↺
          </button>
        </div>
      </div>

      {/* Declare winner */}
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase text-center" style={{ color: '#3D4557' }}>Declare Winner</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => teamA && handleDeclareWinner(teamA.id)}
            disabled={declaring}
            className="py-4 rounded-xl font-black text-base uppercase tracking-wide transition-all disabled:opacity-50"
            style={{ background: 'rgba(255,107,0,0.12)', border: '1.5px solid rgba(255,107,0,0.3)', color: 'var(--orange2)' }}
          >
            🏆 {teamA?.name}
          </button>
          <button
            onClick={() => teamB && handleDeclareWinner(teamB.id)}
            disabled={declaring}
            className="py-4 rounded-xl font-black text-base uppercase tracking-wide transition-all disabled:opacity-50"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1.5px solid rgba(59,130,246,0.25)', color: '#60A5FA' }}
          >
            🏆 {teamB?.name}
          </button>
        </div>
        <p className="text-[10px] text-center" style={{ color: '#3D4557' }}>Updates queue and player stats automatically</p>
      </div>
    </div>
  );
}

function ScoreBtn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg text-white transition-all"
      style={{ background: color }}
    >
      {children}
    </button>
  );
}
