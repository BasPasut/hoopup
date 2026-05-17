'use client';

import { useState } from 'react';
import { Session, Team, Match } from '@/lib/types';
import { createBalancedTeams, extractTeamCompositions, computeTeamSkill, getPositionColor } from '@/lib/matching';

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

// ── Custom team builder ──────────────────────────────────────────────────────

interface CustomTeamDraft {
  name: string;
  playerIds: string[];
}

function CustomTeamBuilder({
  session,
  onSave,
  onCancel,
}: {
  session: Session;
  onSave: (teams: CustomTeamDraft[]) => Promise<void>;
  onCancel: () => void;
}) {
  const playersPerTeam = parseInt(session.settings.gameMode[0]);
  const available = session.players.filter((p) => p.isAvailable);

  const [numTeams, setNumTeams] = useState(Math.max(2, Math.min(4, Math.floor(available.length / playersPerTeam))));
  const [teams, setTeams] = useState<CustomTeamDraft[]>(() =>
    Array.from({ length: Math.max(2, Math.min(4, Math.floor(available.length / playersPerTeam))) }, (_, i) => ({
      name: `Team ${String.fromCharCode(65 + i + session.teams.length)}`,
      playerIds: [],
    }))
  );
  const [saving, setSaving] = useState(false);

  function changeNumTeams(n: number) {
    const clamped = Math.max(2, Math.min(8, n));
    setNumTeams(clamped);
    setTeams((prev) => {
      if (clamped > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: clamped - prev.length }, (_, i) => ({
            name: `Team ${String.fromCharCode(65 + prev.length + i + session.teams.length)}`,
            playerIds: [],
          })),
        ];
      }
      // Remove players from removed teams first
      const kept = prev.slice(0, clamped);
      return kept;
    });
  }

  function assignPlayer(playerId: string, teamIdx: number) {
    setTeams((prev) =>
      prev.map((t, i) => {
        if (i === teamIdx) {
          // toggle off if already on this team
          if (t.playerIds.includes(playerId)) {
            return { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) };
          }
          return { ...t, playerIds: [...t.playerIds, playerId] };
        }
        // remove from any other team
        return { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) };
      })
    );
  }

  function getPlayerTeamIdx(playerId: string): number {
    return teams.findIndex((t) => t.playerIds.includes(playerId));
  }

  const assignedCount = teams.reduce((sum, t) => sum + t.playerIds.length, 0);
  const canSave = teams.every((t) => t.playerIds.length > 0) && teams.length >= 2;

  async function handleSave() {
    setSaving(true);
    await onSave(teams);
    setSaving(false);
  }

  const teamColors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500', 'bg-cyan-500'];

  return (
    <div className="flex flex-col gap-4 bg-gray-800 border border-gray-600 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-white text-lg">Build Custom Teams</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl px-2">×</button>
      </div>

      {/* Number of teams */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 flex-1">Number of teams</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeNumTeams(numTeams - 1)}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center"
          >−</button>
          <span className="text-white font-black w-4 text-center">{numTeams}</span>
          <button
            onClick={() => changeNumTeams(numTeams + 1)}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center"
          >+</button>
        </div>
      </div>

      {/* Team name editors */}
      <div className="flex flex-col gap-2">
        {teams.map((team, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${teamColors[i % teamColors.length]}`} />
            <input
              value={team.name}
              onChange={(e) => setTeams((prev) => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t))}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500"
            />
            <span className="text-xs text-gray-500 w-12 text-right">{team.playerIds.length} players</span>
          </div>
        ))}
      </div>

      {/* Player assignment */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">
          Assign players ({assignedCount}/{available.length})
        </p>
        <div className="flex flex-col gap-1.5">
          {available.map((p) => {
            const assignedTo = getPlayerTeamIdx(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                  <span className="text-white text-sm font-semibold">{p.name}</span>
                  <span className="text-gray-400 text-xs">{'★'.repeat(p.skillLevel)}</span>
                  {assignedTo !== -1 && (
                    <span className={`ml-auto text-xs text-white px-2 py-0.5 rounded-full ${teamColors[assignedTo % teamColors.length]}`}>
                      {teams[assignedTo].name}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {teams.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => assignPlayer(p.id, i)}
                      className={`w-7 h-7 rounded-full text-xs font-black transition-colors ${
                        assignedTo === i
                          ? `${teamColors[i % teamColors.length]} text-white`
                          : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!canSave && (
        <p className="text-xs text-gray-500 text-center">Each team needs at least 1 player</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold transition-colors hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold transition-colors"
        >
          {saving ? 'Saving...' : 'Save Teams'}
        </button>
      </div>
    </div>
  );
}

// ── Main QueueTab ─────────────────────────────────────────────────────────────

export default function QueueTab({ session, onUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [editingTimer, setEditingTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(Math.round(session.settings.timerDuration / 60));

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

  const isEnded = session.status === 'completed';

  async function handleGenerate() {
    setGenerating(true);
    const history = session.teamHistory ?? [];
    const newTeams = createBalancedTeams(available, session.settings.gameMode, session.teams.length, history);
    if (newTeams.length < 2) { setGenerating(false); return; }

    const newCompositions = extractTeamCompositions(newTeams);
    const allTeams = [...session.teams, ...newTeams];
    const newQueueIds = newTeams.map((t) => t.id);
    const updatedQueue = [...session.queue, ...newQueueIds];

    await onUpdate({
      teams: allTeams,
      queue: updatedQueue,
      status: 'active',
      teamHistory: [...history, ...newCompositions],
    });
    setGenerating(false);
  }

  async function handleSaveCustomTeams(drafts: { name: string; playerIds: string[] }[]) {
    const newTeams: Team[] = drafts.map((d) => ({
      id: crypto.randomUUID(),
      name: d.name,
      playerIds: d.playerIds,
      consecutiveWins: 0,
      isResting: false,
      restRoundsLeft: 0,
      stats: { wins: 0, losses: 0, gamesPlayed: 0 },
    }));

    const newCompositions = extractTeamCompositions(newTeams);
    const allTeams = [...session.teams, ...newTeams];
    const newQueueIds = newTeams.map((t) => t.id);
    const updatedQueue = [...session.queue, ...newQueueIds];

    await onUpdate({
      teams: allTeams,
      queue: updatedQueue,
      status: 'active',
      teamHistory: [...(session.teamHistory ?? []), ...newCompositions],
    });
    setShowCustomBuilder(false);
  }

  async function handleClearTeams() {
    if (!confirming) { setConfirming(true); return; }
    await onUpdate({ teams: [], queue: [], currentMatch: null, status: 'setup', teamHistory: [] });
    setConfirming(false);
  }

  async function handleEndSession() {
    if (!confirmingEnd) { setConfirmingEnd(true); return; }
    await onUpdate({ status: 'completed', currentMatch: null });
    setConfirmingEnd(false);
  }

  async function handleSaveTimer() {
    const newDuration = Math.max(1, Math.min(60, timerMinutes)) * 60;
    await onUpdate({ settings: { ...session.settings, timerDuration: newDuration } });
    setEditingTimer(false);
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
      {/* Session ended banner */}
      {isEnded && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">🏁</div>
          <p className="text-red-400 font-black text-lg">Session Ended</p>
          <p className="text-gray-400 text-sm mt-1">
            {session.completedMatches.length} matches played · Check History tab for stats
          </p>
        </div>
      )}

      {/* Tournament info */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="text-sm text-gray-300 leading-relaxed">
          {tournamentDesc[session.settings.tournamentType]}
        </div>

        {/* Timer row with inline edit */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-sm text-gray-400">🏀 {session.settings.gameMode}</span>

          {editingTimer ? (
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setTimerMinutes((v) => Math.max(1, v - 1))}
                className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center text-sm"
              >−</button>
              <span className="text-white font-black text-sm w-14 text-center">{timerMinutes} min</span>
              <button
                onClick={() => setTimerMinutes((v) => Math.min(60, v + 1))}
                className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center text-sm"
              >+</button>
              <button onClick={handleSaveTimer} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-orange-400">
                Save
              </button>
              <button onClick={() => { setEditingTimer(false); setTimerMinutes(Math.round(session.settings.timerDuration / 60)); }} className="text-xs text-gray-400 hover:text-white px-2 py-1">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingTimer(true)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-orange-400 transition-colors"
            >
              ⏱ {session.settings.timerDuration / 60} min
              <span className="text-xs text-gray-600 ml-1">✎</span>
            </button>
          )}

          <span className="text-sm text-gray-400 ml-auto">📋 {session.completedMatches.length} played</span>
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
                <div className="text-green-400 text-sm font-bold mt-1">{session.currentMatch.score.teamA} pts</div>
              </div>
              <div className="text-gray-400 font-bold text-xl">VS</div>
              <div className="text-center flex-1">
                <div className="font-black text-white text-xl">{currentTeamB.name}</div>
                <div className="text-green-400 text-sm font-bold mt-1">{session.currentMatch.score.teamB} pts</div>
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
            {!session.currentMatch && queuedTeams.length >= 2 && !isEnded && (
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
            {restingTeams.map((team) => <TeamCard key={team.id} team={team} session={session} />)}
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
            {idleTeams.map((team) => <TeamCard key={team.id} team={team} session={session} />)}
          </div>
        </div>
      )}

      {/* Custom builder */}
      {showCustomBuilder && !isEnded && (
        <CustomTeamBuilder
          session={session}
          onSave={handleSaveCustomTeams}
          onCancel={() => setShowCustomBuilder(false)}
        />
      )}

      {/* Action buttons */}
      {!isEnded && !showCustomBuilder && (
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
          <button
            onClick={() => setShowCustomBuilder(true)}
            disabled={available.length < 2}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-bold text-base py-3 rounded-xl transition-colors border border-gray-600"
          >
            ✏️ Build Custom Teams
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
      )}

      {session.teams.length === 0 && !showCustomBuilder && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-5xl mb-3">🏀</div>
          <p className="text-lg font-medium">No teams yet</p>
          <p className="text-sm mt-1">Add {playersPerTeam * 2}+ players and generate teams</p>
        </div>
      )}

      {/* End session */}
      {!isEnded && (
        <div className="mt-2 pt-4 border-t border-gray-800">
          <button
            onClick={handleEndSession}
            className={`w-full font-bold text-base py-3 rounded-xl transition-colors ${
              confirmingEnd
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-transparent text-red-500 border border-red-500/40 hover:border-red-500 hover:bg-red-500/10'
            }`}
          >
            {confirmingEnd ? '⚠️ Confirm — End Today\'s Games?' : '🏁 End Day\'s Games'}
          </button>
          {confirmingEnd && (
            <button
              onClick={() => setConfirmingEnd(false)}
              className="w-full mt-2 text-sm text-gray-500 hover:text-gray-300 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
