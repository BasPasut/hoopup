'use client';

import { useState } from 'react';
import { Session, Team, Match } from '@/lib/types';
import { createBalancedTeams, computeTeamSkill, getPositionColor } from '@/lib/matching';

interface Props {
  session: Session;
  onUpdate: (updates: Partial<Session>) => Promise<void>;
}

function TeamCard({
  team, session, rank, badge,
}: {
  team: Team;
  session: Session;
  rank?: number;
  badge?: React.ReactNode;
}) {
  const players = session.players.filter((p) => team.playerIds.includes(p.id));
  const skill = computeTeamSkill(team, session.players);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {rank !== undefined && (
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-black text-gray-300">
              {rank}
            </div>
          )}
          <div>
            <div className="font-black text-white text-lg">{team.name}</div>
            <div className="text-xs text-gray-400">Skill: {skill} pts</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {badge}
          {team.consecutiveWins > 0 && !team.isResting && (
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold">
              🔥 {team.consecutiveWins}W streak
            </span>
          )}
          {team.isResting && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold">
              😮‍💨 Resting {team.restRoundsLeft}R
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 bg-gray-700 rounded-lg px-2.5 py-1.5">
            <span className="font-semibold text-white text-sm">{p.name}</span>
            <div className="flex gap-0.5">
              {p.positions.slice(0, 2).map((pos) => (
                <span key={pos} className={`${getPositionColor(pos)} text-white text-xs font-bold px-1 py-0.5 rounded`}>
                  {pos}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 text-xs text-gray-400">
        <span>🏆 {team.stats.wins}W</span>
        <span>❌ {team.stats.losses}L</span>
        <span>📊 {team.stats.gamesPlayed} games</span>
      </div>
    </div>
  );
}

export default function QueueTab({ session, onUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const queuedTeams = session.queue.map((id) => session.teams.find((t) => t.id === id)).filter(Boolean) as Team[];
  const restingTeams = session.teams.filter((t) => t.isResting);
  const idleTeams = session.teams.filter(
    (t) => !t.isResting && !session.queue.includes(t.id) && session.currentMatch?.teamAId !== t.id && session.currentMatch?.teamBId !== t.id
  );

  const currentTeamA = session.currentMatch
    ? session.teams.find((t) => t.id === session.currentMatch!.teamAId)
    : null;
  const currentTeamB = session.currentMatch
    ? session.teams.find((t) => t.id === session.currentMatch!.teamBId)
    : null;

  const available = session.players.filter((p) => p.isAvailable);
  const playersPerTeam = parseInt(session.settings.gameMode[0]);
  const canGenerate = Math.floor(available.length / playersPerTeam) >= 2;

  async function handleGenerate() {
    setGenerating(true);
    const newTeams = createBalancedTeams(available, session.settings.gameMode, session.teams.length);
    if (newTeams.length < 2) { setGenerating(false); return; }

    const allTeams = [...session.teams, ...newTeams];
    const newQueueIds = newTeams.map((t) => t.id);
    const updatedQueue = [...session.queue, ...newQueueIds];

    await onUpdate({ teams: allTeams, queue: updatedQueue, status: 'active' });
    setGenerating(false);
  }

  async function handleClearTeams() {
    if (!confirming) { setConfirming(true); return; }
    await onUpdate({ teams: [], queue: [], currentMatch: null, status: 'setup' });
    setConfirming(false);
  }

  async function handleStartNextMatch() {
    if (queuedTeams.length < 2) return;
    const [teamA, teamB, ...restQueue] = queuedTeams;
    const newMatch: Match = {
      id: crypto.randomUUID(),
      teamAId: teamA.id,
      teamBId: teamB.id,
      startedAt: null,
      endedAt: null,
      timerDuration: session.settings.timerDuration,
      isPaused: false,
      pausedAt: null,
      elapsedSeconds: 0,
      score: { teamA: 0, teamB: 0 },
      winnerId: null,
      round: session.completedMatches.length + 1,
    };
    await onUpdate({
      currentMatch: newMatch,
      queue: restQueue.map((t) => t.id),
    });
  }

  async function moveTeamUp(teamId: string) {
    const idx = session.queue.indexOf(teamId);
    if (idx <= 0) return;
    const newQueue = [...session.queue];
    [newQueue[idx - 1], newQueue[idx]] = [newQueue[idx], newQueue[idx - 1]];
    await onUpdate({ queue: newQueue });
  }

  async function moveTeamDown(teamId: string) {
    const idx = session.queue.indexOf(teamId);
    if (idx === -1 || idx >= session.queue.length - 1) return;
    const newQueue = [...session.queue];
    [newQueue[idx], newQueue[idx + 1]] = [newQueue[idx + 1], newQueue[idx]];
    await onUpdate({ queue: newQueue });
  }

  const tournamentDesc: Record<string, string> = {
    'king-of-court': `👑 King of the Court — Winner stays. After ${session.settings.consecutiveWinsToRest} consecutive wins, sit out 1 round.`,
    'round-robin': '🔄 Round Robin — Every team plays every other team.',
    'elimination': '⚡ Single Elimination — Lose once, you\'re out.',
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Tournament info */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="text-sm text-gray-300 leading-relaxed">
          {tournamentDesc[session.settings.tournamentType]}
        </div>
        <div className="flex gap-3 mt-3 text-sm text-gray-400">
          <span>🏀 {session.settings.gameMode}</span>
          <span>⏱ {session.settings.timerDuration / 60} min</span>
          <span>📋 {session.completedMatches.length} matches played</span>
        </div>
      </div>

      {/* Current match */}
      {session.currentMatch && currentTeamA && currentTeamB && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">🟢 On Court Now</h3>
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <div className="font-black text-white text-xl">{currentTeamA.name}</div>
                <div className="text-green-400 text-sm font-bold mt-1">
                  {session.currentMatch.score.teamA} pts
                </div>
              </div>
              <div className="text-gray-400 font-bold text-xl">VS</div>
              <div className="text-center flex-1">
                <div className="font-black text-white text-xl">{currentTeamB.name}</div>
                <div className="text-green-400 text-sm font-bold mt-1">
                  {session.currentMatch.score.teamB} pts
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue */}
      {queuedTeams.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              📋 Queue ({queuedTeams.length} teams)
            </h3>
            {!session.currentMatch && queuedTeams.length >= 2 && (
              <button
                onClick={handleStartNextMatch}
                className="text-sm bg-green-500 hover:bg-green-400 text-white font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                ▶ Start Match
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {queuedTeams.map((team, idx) => (
              <div key={team.id} className="flex items-stretch gap-2">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveTeamUp(team.id)}
                    disabled={idx === 0}
                    className="flex-1 px-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg text-gray-300 text-sm transition-colors"
                  >↑</button>
                  <button
                    onClick={() => moveTeamDown(team.id)}
                    disabled={idx === queuedTeams.length - 1}
                    className="flex-1 px-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg text-gray-300 text-sm transition-colors"
                  >↓</button>
                </div>
                <div className="flex-1">
                  <TeamCard
                    team={team}
                    session={session}
                    rank={idx + 1}
                    badge={idx === 0 && !session.currentMatch ? (
                      <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">
                        Next Up
                      </span>
                    ) : idx === 1 && !session.currentMatch ? (
                      <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                        On Deck
                      </span>
                    ) : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resting teams */}
      {restingTeams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            😮‍💨 Resting ({restingTeams.length})
          </h3>
          <div className="flex flex-col gap-2">
            {restingTeams.map((team) => (
              <TeamCard key={team.id} team={team} session={session} />
            ))}
          </div>
        </div>
      )}

      {/* Idle teams */}
      {idleTeams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            ⏸ Idle ({idleTeams.length})
          </h3>
          <div className="flex flex-col gap-2">
            {idleTeams.map((team) => (
              <TeamCard key={team.id} team={team} session={session} />
            ))}
          </div>
        </div>
      )}

      {/* Generate teams */}
      <div className="flex flex-col gap-2">
        {!canGenerate && (
          <p className="text-sm text-gray-500 text-center">
            Need at least {playersPerTeam * 2} available players for {session.settings.gameMode} ({available.length} available)
          </p>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-xl transition-colors"
        >
          {generating ? 'Generating...' : '⚡ Generate Balanced Teams'}
        </button>
        {session.teams.length > 0 && (
          <button
            onClick={handleClearTeams}
            className={`w-full font-bold text-base py-3 rounded-xl transition-colors ${
              confirming
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
            }`}
          >
            {confirming ? '⚠️ Tap again to confirm clear' : '🗑 Clear All Teams'}
          </button>
        )}
      </div>

      {session.teams.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-5xl mb-3">🏀</div>
          <p className="text-lg font-medium">No teams yet</p>
          <p className="text-sm mt-1">Add {playersPerTeam * 2}+ players and generate teams</p>
        </div>
      )}
    </div>
  );
}
