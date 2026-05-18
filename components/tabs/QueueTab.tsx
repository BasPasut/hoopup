'use client';

import { useState } from 'react';
import { Session, Team, Match } from '@/lib/types';
import { createBalancedTeams, extractTeamCompositions, computeTeamSkill, getPositionColor } from '@/lib/matching';

interface Props {
  session: Session;
  onUpdate: (updates: Partial<Session>) => Promise<void>;
}

function TeamCard({ team, session, rank, badge, onRename }: { team: Team; session: Session; rank?: number; badge?: React.ReactNode; onRename?: (name: string) => void }) {
  const players = session.players.filter((p) => team.playerIds.includes(p.id));
  const skill = computeTeamSkill(team, session.players);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const isUndersized = players.length < parseInt(session.settings.gameMode[0]);

  function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== team.name) onRename?.(trimmed);
    else setNameInput(team.name);
    setEditing(false);
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: 'var(--card)',
        border: `1.5px solid ${isUndersized ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {rank !== undefined && (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black"
              style={{ background: 'var(--surface)', color: '#8892A4' }}
            >
              {rank}
            </div>
          )}
          <div>
            {editing ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setNameInput(team.name); setEditing(false); } }}
                className="font-display text-xl tracking-widest text-white leading-none bg-transparent border-b focus:outline-none w-36"
                style={{ borderColor: 'var(--orange)' }}
              />
            ) : (
              <button
                onClick={() => onRename && setEditing(true)}
                className="font-display text-xl tracking-widest text-white leading-none flex items-center gap-1.5 group"
                title={onRename ? 'Tap to rename' : undefined}
              >
                {team.name}
                {onRename && <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#3D4557' }}>✎</span>}
              </button>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold" style={{ color: '#3D4557' }}>Skill: {skill} pts</span>
              {isUndersized && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#FBBF24' }}>
                  {players.length}/{session.settings.gameMode[0]} — needs players
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {badge}
          {team.consecutiveWins > 0 && !team.isResting && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,107,0,0.12)', border: '1px solid rgba(255,107,0,0.25)', color: 'var(--orange2)' }}>
              🔥 {team.consecutiveWins}W streak
            </span>
          )}
          {team.isResting && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#FBBF24' }}>
              😮‍💨 Resting {team.restRoundsLeft}R
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="font-semibold text-white text-xs">{p.name}</span>
            {p.positions.map((pos) => (
              <span key={pos} className={`${getPositionColor(pos)} text-white text-[9px] font-bold px-1 py-0.5 rounded`}>{pos}</span>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-3 text-[10px] font-semibold" style={{ color: '#3D4557' }}>
        <span>🏆 {team.stats.wins}W</span>
        <span>❌ {team.stats.losses}L</span>
        <span>📊 {team.stats.gamesPlayed} games</span>
      </div>
    </div>
  );
}

interface CustomTeamDraft { name: string; playerIds: string[]; }

function CustomTeamBuilder({ session, onSave, onCancel }: { session: Session; onSave: (teams: CustomTeamDraft[]) => Promise<void>; onCancel: () => void; }) {
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
      if (clamped > prev.length) return [...prev, ...Array.from({ length: clamped - prev.length }, (_, i) => ({ name: `Team ${String.fromCharCode(65 + prev.length + i + session.teams.length)}`, playerIds: [] }))];
      return prev.slice(0, clamped);
    });
  }

  function assignPlayer(playerId: string, teamIdx: number) {
    setTeams((prev) => prev.map((t, i) => {
      if (i === teamIdx) return t.playerIds.includes(playerId) ? { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) } : { ...t, playerIds: [...t.playerIds, playerId] };
      return { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) };
    }));
  }

  function getPlayerTeamIdx(playerId: string): number { return teams.findIndex((t) => t.playerIds.includes(playerId)); }

  const assignedCount = teams.reduce((sum, t) => sum + t.playerIds.length, 0);
  const canSave = teams.every((t) => t.playerIds.length > 0) && teams.length >= 2;

  async function handleSave() { setSaving(true); await onSave(teams); setSaving(false); }

  const teamColors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500', 'bg-cyan-500'];

  return (
    <div className="flex flex-col gap-4 rounded-2xl p-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl tracking-widest text-white">Build Custom Teams</h3>
        <button onClick={onCancel} className="text-2xl" style={{ color: '#3D4557' }}>×</button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm flex-1" style={{ color: '#8892A4' }}>Number of teams</span>
        <div className="flex items-center gap-2">
          <button onClick={() => changeNumTeams(numTeams - 1)} className="w-8 h-8 rounded-xl font-bold text-white flex items-center justify-center" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}>−</button>
          <span className="text-white font-black w-4 text-center">{numTeams}</span>
          <button onClick={() => changeNumTeams(numTeams + 1)} className="w-8 h-8 rounded-xl font-bold text-white flex items-center justify-center" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}>+</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {teams.map((team, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${teamColors[i % teamColors.length]}`} />
            <input
              value={team.name}
              onChange={(e) => setTeams((prev) => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t))}
              className="flex-1 rounded-lg px-3 py-1.5 text-white text-sm font-semibold focus:outline-none"
              style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <span className="text-[10px] w-14 text-right" style={{ color: '#3D4557' }}>{team.playerIds.length} players</span>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#3D4557' }}>
          Assign players ({assignedCount}/{available.length})
        </p>
        <div className="flex flex-col gap-1.5">
          {available.map((p) => {
            const assignedTo = getPlayerTeamIdx(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="text-white text-sm font-semibold">{p.name}</span>
                  <span className="text-xs" style={{ color: 'var(--orange)' }}>{'★'.repeat(p.skillLevel)}</span>
                  {assignedTo !== -1 && (
                    <span className={`ml-auto text-[10px] text-white px-2 py-0.5 rounded-full font-bold ${teamColors[assignedTo % teamColors.length]}`}>
                      {teams[assignedTo].name}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {teams.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => assignPlayer(p.id, i)}
                      className={`w-7 h-7 rounded-full text-xs font-black transition-colors ${assignedTo === i ? `${teamColors[i % teamColors.length]} text-white` : 'text-gray-300'}`}
                      style={assignedTo !== i ? { background: 'var(--surface)', border: '1px solid var(--border)' } : {}}
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

      {!canSave && <p className="text-[10px] text-center" style={{ color: '#3D4557' }}>Each team needs at least 1 player</p>}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold transition-all" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}>Cancel</button>
        <button onClick={handleSave} disabled={!canSave || saving} className="flex-1 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)' }}>
          {saving ? 'Saving...' : 'Save Teams'}
        </button>
      </div>
    </div>
  );
}

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
  const currentTeamA = session.currentMatch ? session.teams.find((t) => t.id === session.currentMatch!.teamAId) : null;
  const currentTeamB = session.currentMatch ? session.teams.find((t) => t.id === session.currentMatch!.teamBId) : null;
  const available = session.players.filter((p) => p.isAvailable);
  const playersPerTeam = parseInt(session.settings.gameMode[0]);
  const canGenerate = Math.floor(available.length / playersPerTeam) >= 2;
  const isEnded = session.status === 'completed';

  async function handleGenerate() {
    setGenerating(true);
    const history = session.teamHistory ?? [];
    const newTeams = createBalancedTeams(available, session.settings.gameMode, 0, history);
    if (newTeams.length < 2) { setGenerating(false); return; }
    const newCompositions = extractTeamCompositions(newTeams);
    await onUpdate({ teams: newTeams, queue: newTeams.map((t) => t.id), currentMatch: null, status: 'active', teamHistory: [...history, ...newCompositions] });
    setGenerating(false);
  }

  async function handleSaveCustomTeams(drafts: { name: string; playerIds: string[] }[]) {
    const newTeams: Team[] = drafts.map((d) => ({ id: crypto.randomUUID(), name: d.name, playerIds: d.playerIds, consecutiveWins: 0, isResting: false, restRoundsLeft: 0, stats: { wins: 0, losses: 0, gamesPlayed: 0 } }));
    const newCompositions = extractTeamCompositions(newTeams);
    const allTeams = [...session.teams, ...newTeams];
    await onUpdate({ teams: allTeams, queue: [...session.queue, ...newTeams.map((t) => t.id)], status: 'active', teamHistory: [...(session.teamHistory ?? []), ...newCompositions] });
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
    const newMatch: Match = { id: crypto.randomUUID(), teamAId: teamA.id, teamBId: teamB.id, startedAt: null, endedAt: null, timerDuration: session.settings.timerDuration, isPaused: false, pausedAt: null, elapsedSeconds: 0, score: { teamA: 0, teamB: 0 }, winnerId: null, round: session.completedMatches.length + 1 };
    await onUpdate({ currentMatch: newMatch, queue: restQueue.map((t) => t.id) });
  }

  async function moveTeamUp(teamId: string) {
    const idx = session.queue.indexOf(teamId);
    if (idx <= 0) return;
    const newQueue = [...session.queue];
    [newQueue[idx - 1], newQueue[idx]] = [newQueue[idx], newQueue[idx - 1]];
    await onUpdate({ queue: newQueue });
  }

  async function handleRenameTeam(teamId: string, newName: string) {
    const updatedTeams = session.teams.map((t) => t.id === teamId ? { ...t, name: newName } : t);
    await onUpdate({ teams: updatedTeams });
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
    'round-robin':   '🔄 Round Robin — Every team plays every other team.',
    'elimination':   '⚡ Single Elimination — Lose once, you\'re out.',
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Session ended banner */}
      {isEnded && (
        <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.3)' }}>
          <div className="text-2xl mb-1">🏁</div>
          <p className="font-display text-2xl tracking-widest text-red-400">Session Ended</p>
          <p className="text-sm mt-1" style={{ color: '#8892A4' }}>{session.completedMatches.length} matches played · Check Stats tab</p>
        </div>
      )}

      {/* Tournament info */}
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
        <div className="text-sm leading-relaxed" style={{ color: '#CDD5E0' }}>{tournamentDesc[session.settings.tournamentType]}</div>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-sm" style={{ color: '#8892A4' }}>🏀 {session.settings.gameMode}</span>
          {editingTimer ? (
            <div className="flex items-center gap-2 flex-1">
              <button onClick={() => setTimerMinutes((v) => Math.max(1, v - 1))} className="w-7 h-7 rounded-lg font-bold text-white flex items-center justify-center text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>−</button>
              <span className="text-white font-black text-sm w-14 text-center">{timerMinutes} min</span>
              <button onClick={() => setTimerMinutes((v) => Math.min(60, v + 1))} className="w-7 h-7 rounded-lg font-bold text-white flex items-center justify-center text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>+</button>
              <button onClick={handleSaveTimer} className="text-[10px] font-bold px-3 py-1 rounded-lg text-white" style={{ background: 'var(--orange)' }}>Save</button>
              <button onClick={() => { setEditingTimer(false); setTimerMinutes(Math.round(session.settings.timerDuration / 60)); }} className="text-[10px] px-2 py-1" style={{ color: '#8892A4' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setEditingTimer(true)} className="flex items-center gap-1 text-sm transition-colors hover:text-orange-400" style={{ color: '#8892A4' }}>
              ⏱ {session.settings.timerDuration / 60} min <span className="text-xs ml-1" style={{ color: '#3D4557' }}>✎</span>
            </button>
          )}
          <span className="text-sm ml-auto" style={{ color: '#3D4557' }}>📋 {session.completedMatches.length} played</span>
        </div>
      </div>

      {/* On court now */}
      {session.currentMatch && currentTeamA && currentTeamB && (
        <div>
          <SectionLabel>On Court Now</SectionLabel>
          <div className="rounded-xl p-4 mt-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1.5px solid rgba(34,197,94,0.2)' }}>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <div className="font-display text-2xl tracking-widest text-white">{currentTeamA.name}</div>
                <div className="text-sm font-bold mt-1 text-green-400">{session.currentMatch.score.teamA} pts</div>
              </div>
              <div className="text-xs font-black tracking-widest" style={{ color: '#3D4557' }}>VS</div>
              <div className="text-center flex-1">
                <div className="font-display text-2xl tracking-widest text-white">{currentTeamB.name}</div>
                <div className="text-sm font-bold mt-1 text-green-400">{session.currentMatch.score.teamB} pts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue */}
      {queuedTeams.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel count={queuedTeams.length}>Queue</SectionLabel>
            {!session.currentMatch && queuedTeams.length >= 2 && !isEnded && (
              <button
                onClick={handleStartNextMatch}
                className="text-sm font-bold px-3 py-1.5 rounded-lg text-white uppercase tracking-wide ml-auto"
                style={{ background: '#22C55E', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
              >
                ▶ Start Match
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {queuedTeams.map((team, idx) => (
              <div key={team.id} className="flex items-stretch gap-2">
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveTeamUp(team.id)} disabled={idx === 0} className="flex-1 px-2 rounded-lg text-sm transition-colors disabled:opacity-20" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: '#8892A4' }}>↑</button>
                  <button onClick={() => moveTeamDown(team.id)} disabled={idx === queuedTeams.length - 1} className="flex-1 px-2 rounded-lg text-sm transition-colors disabled:opacity-20" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: '#8892A4' }}>↓</button>
                </div>
                <div className="flex-1">
                  <TeamCard
                    team={team} session={session} rank={idx + 1}
                    onRename={(name) => handleRenameTeam(team.id, name)}
                    badge={
                      idx === 0 && !session.currentMatch
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ADE80' }}>Next Up</span>
                        : idx === 1 && !session.currentMatch
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60A5FA' }}>On Deck</span>
                        : undefined
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {restingTeams.length > 0 && (
        <div>
          <SectionLabel count={restingTeams.length}>Resting</SectionLabel>
          <div className="flex flex-col gap-2 mt-2">{restingTeams.map((team) => <TeamCard key={team.id} team={team} session={session} onRename={(name) => handleRenameTeam(team.id, name)} />)}</div>
        </div>
      )}

      {idleTeams.length > 0 && (
        <div>
          <SectionLabel count={idleTeams.length}>Idle</SectionLabel>
          <div className="flex flex-col gap-2 mt-2">{idleTeams.map((team) => <TeamCard key={team.id} team={team} session={session} onRename={(name) => handleRenameTeam(team.id, name)} />)}</div>
        </div>
      )}

      {showCustomBuilder && !isEnded && <CustomTeamBuilder session={session} onSave={handleSaveCustomTeams} onCancel={() => setShowCustomBuilder(false)} />}

      {!isEnded && !showCustomBuilder && (
        <div className="flex flex-col gap-2">
          {!canGenerate && (
            <p className="text-sm text-center" style={{ color: '#3D4557' }}>
              Need at least {playersPerTeam * 2} available players ({available.length} available)
            </p>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="w-full text-white font-bold text-base py-4 rounded-xl transition-all disabled:opacity-40 uppercase tracking-wide"
            style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 6px 20px rgba(255,107,0,0.3)' }}
          >
            {generating ? 'Generating...' : '⚡ Generate Balanced Teams'}
          </button>
          <button
            onClick={() => setShowCustomBuilder(true)}
            disabled={available.length < 2}
            className="w-full font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-40 uppercase tracking-wide"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', color: '#CDD5E0' }}
          >
            ✏️ Build Custom Teams
          </button>
          {session.teams.length > 0 && (
            <button
              onClick={handleClearTeams}
              className="w-full font-bold text-sm py-3 rounded-xl transition-all uppercase tracking-wide"
              style={
                confirming
                  ? { background: '#EF4444', color: 'white' }
                  : { background: 'transparent', border: '1.5px solid rgba(239,68,68,0.3)', color: '#F87171' }
              }
            >
              {confirming ? '⚠️ Tap again to confirm clear' : '🗑 Clear All Teams'}
            </button>
          )}
        </div>
      )}

      {session.teams.length === 0 && !showCustomBuilder && (
        <div className="flex flex-col items-center py-10" style={{ color: '#3D4557' }}>
          <div className="text-5xl mb-3">🏀</div>
          <p className="text-base font-bold">No teams yet</p>
          <p className="text-sm mt-1">Add {playersPerTeam * 2}+ players and generate teams</p>
        </div>
      )}

      {!isEnded && (
        <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleEndSession}
            className="w-full font-bold text-sm py-3 rounded-xl transition-all uppercase tracking-wide"
            style={
              confirmingEnd
                ? { background: '#DC2626', color: 'white' }
                : { background: 'transparent', border: '1.5px solid rgba(239,68,68,0.3)', color: '#F87171' }
            }
          >
            {confirmingEnd ? "⚠️ Confirm — End Today's Games?" : '🏁 End Day\'s Games'}
          </button>
          {confirmingEnd && (
            <button onClick={() => setConfirmingEnd(false)} className="w-full mt-2 text-sm py-2 transition-colors" style={{ color: '#3D4557' }}>Cancel</button>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#3D4557' }}>{children}</span>
      {count !== undefined && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)', color: 'var(--orange2)' }}>
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}
