'use client';

import { useState, useEffect, useRef } from 'react';
import { Session, Team, Player, Match } from '@/lib/types';
import { createBalancedTeams, extractTeamCompositions, computeTeamSkill, getPositionColor } from '@/lib/matching';

interface Props {
  session: Session;
  onUpdate: (updates: Partial<Session>) => Promise<void>;
}

// ─── TeamCard ────────────────────────────────────────────────────────────────

function TeamCard({
  team, session, rank, badge, onRename,
}: {
  team: Team; session: Session; rank?: number; badge?: React.ReactNode; onRename?: (name: string) => void;
}) {
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
      style={{ background: 'var(--card)', border: `1.5px solid ${isUndersized ? 'rgba(251,191,36,0.3)' : 'var(--border)'}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {rank !== undefined && (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: 'var(--surface)', color: '#8892A4' }}>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setNameInput(team.name); setEditing(false); }
                }}
                className="font-display text-xl tracking-widest text-white leading-none bg-transparent border-b focus:outline-none w-36"
                style={{ borderColor: 'var(--orange)' }}
              />
            ) : (
              <button
                onClick={() => onRename && setEditing(true)}
                className="font-display text-xl tracking-widest text-white leading-none flex items-center gap-2"
                title={onRename ? 'Tap to rename' : undefined}
              >
                {team.name}
                {onRename && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-md text-[11px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: '#8892A4' }}>
                    ✎
                  </span>
                )}
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

// ─── CustomTeamBuilder ────────────────────────────────────────────────────────

interface CustomTeamDraft { name: string; playerIds: string[]; }

function CustomTeamBuilder({
  session, onSave, onCancel,
}: {
  session: Session; onSave: (teams: CustomTeamDraft[]) => Promise<void>; onCancel: () => void;
}) {
  const playersPerTeam = parseInt(session.settings.gameMode[0]);
  const available = session.players.filter((p) => p.isAvailable);
  const initCount = Math.max(2, Math.min(4, Math.floor(available.length / playersPerTeam)));
  const [numTeams, setNumTeams] = useState(initCount);
  const [teams, setTeams] = useState<CustomTeamDraft[]>(() =>
    Array.from({ length: initCount }, (_, i) => ({
      name: `Team ${String.fromCharCode(65 + i + session.teams.length)}`,
      playerIds: [],
    }))
  );
  const [saving, setSaving] = useState(false);
  const teamColors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500', 'bg-cyan-500'];

  function changeNumTeams(n: number) {
    const clamped = Math.max(2, Math.min(8, n));
    setNumTeams(clamped);
    setTeams((prev) =>
      clamped > prev.length
        ? [...prev, ...Array.from({ length: clamped - prev.length }, (_, i) => ({ name: `Team ${String.fromCharCode(65 + prev.length + i + session.teams.length)}`, playerIds: [] }))]
        : prev.slice(0, clamped)
    );
  }

  function assignPlayer(playerId: string, teamIdx: number) {
    setTeams((prev) =>
      prev.map((t, i) => {
        if (i === teamIdx) return t.playerIds.includes(playerId) ? { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) } : { ...t, playerIds: [...t.playerIds, playerId] };
        return { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) };
      })
    );
  }

  function getPlayerTeamIdx(playerId: string) { return teams.findIndex((t) => t.playerIds.includes(playerId)); }

  const assignedCount = teams.reduce((sum, t) => sum + t.playerIds.length, 0);
  const canSave = teams.every((t) => t.playerIds.length > 0) && teams.length >= 2;

  async function handleSave() { setSaving(true); await onSave(teams); setSaving(false); }

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
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}>Cancel</button>
        <button onClick={handleSave} disabled={!canSave || saving} className="flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)' }}>
          {saving ? 'Saving...' : 'Save Teams'}
        </button>
      </div>
    </div>
  );
}

// ─── TeamEditorPanel ──────────────────────────────────────────────────────────
// Fixed-position columns per team; drag a player chip onto another team's
// chip to swap them, or onto an empty area of a team to move them.

function TeamEditorPanel({
  session,
  onSwap,
}: {
  session: Session;
  onSwap: (fromTeamId: string, fromPlayerId: string, toTeamId: string, toPlayerId: string | null) => Promise<void>;
}) {
  const [dragVisual, setDragVisual] = useState<{
    playerId: string;
    fromTeamId: string;
    curX: number;
    curY: number;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ teamId: string; playerId: string | null } | null>(null);
  const [swapping, setSwapping] = useState(false);

  // Refs so async event handlers always read latest values
  const dragRef = useRef<{ playerId: string; fromTeamId: string } | null>(null);
  const dropRef = useRef<{ teamId: string; playerId: string | null } | null>(null);
  useEffect(() => { dropRef.current = dropTarget; }, [dropTarget]);

  function startDrag(playerId: string, fromTeamId: string, clientX: number, clientY: number) {
    dragRef.current = { playerId, fromTeamId };
    setDragVisual({ playerId, fromTeamId, curX: clientX, curY: clientY });

    function onMove(e: PointerEvent) {
      setDragVisual((v) => (v ? { ...v, curX: e.clientX, curY: e.clientY } : null));

      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) { setDropTarget(null); return; }

      // Player chip takes priority over team card
      const chip = el.closest('[data-pid]') as HTMLElement | null;
      if (chip) {
        const pid = chip.getAttribute('data-pid');
        const tid = chip.getAttribute('data-tid');
        // Ignore source chip and chips on the same team
        if (pid === playerId || tid === fromTeamId) { setDropTarget(null); return; }
        if (pid && tid) { setDropTarget({ teamId: tid, playerId: pid }); return; }
      }

      const card = el.closest('[data-tid]') as HTMLElement | null;
      if (card) {
        const tid = card.getAttribute('data-tid');
        if (tid && tid !== fromTeamId) { setDropTarget({ teamId: tid, playerId: null }); return; }
      }

      setDropTarget(null);
    }

    async function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const d = dragRef.current;
      const t = dropRef.current;
      dragRef.current = null;
      setDragVisual(null);
      setDropTarget(null);
      if (d && t && t.teamId !== d.fromTeamId) {
        setSwapping(true);
        await onSwap(d.fromTeamId, d.playerId, t.teamId, t.playerId);
        setSwapping(false);
      }
    }

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp);
  }

  const playerMap = new Map(session.players.map((p) => [p.id, p]));
  const teams = session.teams;
  const teamSkills = teams.map((t) => computeTeamSkill(t, session.players));
  const maxSkill = teams.length > 0 ? Math.max(...teamSkills) : 0;
  const minSkill = teams.length > 0 ? Math.min(...teamSkills) : 0;
  const skillDiff = maxSkill - minSkill;
  const useGrid = teams.length <= 2;

  return (
    <div className="flex flex-col gap-3">
      {/* Balance indicator */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>
          Drag players between teams to swap
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={
            skillDiff <= 1
              ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ADE80' }
              : { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }
          }
        >
          {skillDiff <= 1 ? '✓ Balanced' : `${skillDiff}pt gap`}
        </span>
      </div>

      {/* Team columns — 2-team grid, 3+ horizontal scroll */}
      <div
        className={useGrid ? 'grid grid-cols-2 gap-3' : 'flex gap-3 overflow-x-auto pb-1'}
      >
        {teams.map((team, ti) => {
          const teamPlayers = team.playerIds.map((id) => playerMap.get(id)).filter((p): p is Player => !!p);
          const isTeamDrop = dropTarget?.teamId === team.id && dropTarget.playerId === null;
          const isStrongest = teamSkills[ti] === maxSkill && skillDiff > 0;

          return (
            <div
              key={team.id}
              data-tid={team.id}
              className="flex flex-col gap-2 rounded-xl p-3 transition-colors"
              style={{
                ...(!useGrid && { width: '160px', flexShrink: 0 }),
                background: isTeamDrop ? 'rgba(255,107,0,0.07)' : 'var(--card)',
                border: `1.5px solid ${isTeamDrop ? 'var(--orange)' : 'var(--border)'}`,
                minHeight: '140px',
              }}
            >
              {/* Team header */}
              <div className="flex items-center justify-between gap-1">
                <span className="font-display text-sm tracking-widest text-white truncate">{team.name}</span>
                <span
                  className="text-[10px] font-bold shrink-0"
                  style={{ color: isStrongest ? 'var(--orange2)' : '#3D4557' }}
                >
                  {teamSkills[ti]}★
                </span>
              </div>

              {/* Player chips */}
              <div className="flex flex-col gap-1.5 flex-1">
                {teamPlayers.map((player) => {
                  const isDragging = dragVisual?.playerId === player.id;
                  const isDropOver = dropTarget?.teamId === team.id && dropTarget?.playerId === player.id;
                  return (
                    <div
                      key={player.id}
                      data-pid={player.id}
                      data-tid={team.id}
                      onPointerDown={(e) => {
                        if (swapping) return;
                        e.preventDefault();
                        startDrag(player.id, team.id, e.clientX, e.clientY);
                      }}
                      className="rounded-lg px-2 py-1.5 flex items-center gap-1 select-none"
                      style={{
                        background: isDropOver ? 'rgba(255,107,0,0.15)' : 'var(--surface)',
                        border: `1px solid ${isDropOver ? 'var(--orange)' : isDragging ? 'rgba(255,107,0,0.15)' : 'var(--border)'}`,
                        opacity: isDragging ? 0.25 : 1,
                        cursor: swapping ? 'wait' : 'grab',
                        touchAction: 'none',
                        transition: 'background 0.1s, border-color 0.1s, opacity 0.15s',
                        boxShadow: isDropOver ? '0 0 10px rgba(255,107,0,0.2)' : 'none',
                      }}
                    >
                      <span className="text-white text-xs font-semibold flex-1 truncate leading-none">{player.name}</span>
                      {player.positions[0] && (
                        <span className={`${getPositionColor(player.positions[0])} text-white text-[8px] font-bold px-1 py-0.5 rounded shrink-0`}>
                          {player.positions[0]}
                        </span>
                      )}
                      <span className="text-[9px] shrink-0" style={{ color: 'var(--orange2)' }}>{'★'.repeat(player.skillLevel)}</span>
                    </div>
                  );
                })}

                {teamPlayers.length === 0 && (
                  <div
                    className="flex-1 rounded-lg flex items-center justify-center text-[10px] font-semibold"
                    style={{
                      border: `1px dashed ${isTeamDrop ? 'var(--orange)' : 'var(--border)'}`,
                      minHeight: '56px',
                      color: isTeamDrop ? 'var(--orange2)' : '#3D4557',
                    }}
                  >
                    {isTeamDrop ? 'Drop here' : 'Empty'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {swapping && (
        <p className="text-[10px] text-center animate-pulse" style={{ color: '#8892A4' }}>Saving lineup…</p>
      )}

      {/* Floating drag ghost — follows finger/cursor */}
      {dragVisual && (() => {
        const player = playerMap.get(dragVisual.playerId);
        if (!player) return null;
        return (
          <div
            style={{
              position: 'fixed',
              left: dragVisual.curX,
              top: dragVisual.curY,
              transform: 'translate(-50%, -50%) rotate(-4deg) scale(1.1)',
              pointerEvents: 'none',
              zIndex: 9999,
              background: 'var(--orange)',
              borderRadius: '10px',
              padding: '7px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 12px 32px rgba(255,107,0,0.5)',
              willChange: 'left, top',
            }}
          >
            <span style={{ color: 'white', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>{player.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px' }}>{'★'.repeat(player.skillLevel)}</span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── QueueTab ─────────────────────────────────────────────────────────────────

export default function QueueTab({ session, onUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingTimer, setEditingTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(Math.round(session.settings.timerDuration / 60));
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-cancel confirming states if the user doesn't follow through
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  useEffect(() => {
    if (!confirmingEnd) return;
    const t = setTimeout(() => setConfirmingEnd(false), 3000);
    return () => clearTimeout(t);
  }, [confirmingEnd]);

  // Close editor when teams are cleared
  useEffect(() => {
    if (session.teams.length === 0) setEditMode(false);
  }, [session.teams.length]);

  // ── Queue drag-to-reorder ──────────────────────────────────────────────────

  function getHoverIdx(clientY: number): number {
    const refs = rowRefs.current;
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i];
      if (!el) continue;
      if (clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) return i;
    }
    return refs.length - 1;
  }

  function handleDragPointerDown(idx: number, e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
    setOverIdx(idx);
  }

  function handleDragPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (draggingIdx === null) return;
    setOverIdx(getHoverIdx(e.clientY));
  }

  async function handleDragPointerUp() {
    if (draggingIdx !== null && overIdx !== null && draggingIdx !== overIdx) {
      const newQueue = [...session.queue];
      const [removed] = newQueue.splice(draggingIdx, 1);
      newQueue.splice(overIdx, 0, removed);
      await onUpdate({ queue: newQueue });
    }
    setDraggingIdx(null);
    setOverIdx(null);
  }

  // ── Derived data ───────────────────────────────────────────────────────────

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

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    const history = session.teamHistory ?? [];
    const newTeams = createBalancedTeams(available, session.settings.gameMode, 0, history);
    if (newTeams.length < 2) { setGenerating(false); return; }
    const newCompositions = extractTeamCompositions(newTeams);
    await onUpdate({ teams: newTeams, queue: newTeams.map((t) => t.id), currentMatch: null, status: 'active', teamHistory: [...history, ...newCompositions] });
    setGenerating(false);
  }

  async function handleSaveCustomTeams(drafts: CustomTeamDraft[]) {
    const newTeams: Team[] = drafts.map((d) => ({
      id: crypto.randomUUID(), name: d.name, playerIds: d.playerIds,
      consecutiveWins: 0, isResting: false, restRoundsLeft: 0, stats: { wins: 0, losses: 0, gamesPlayed: 0 },
    }));
    const newCompositions = extractTeamCompositions(newTeams);
    await onUpdate({
      teams: [...session.teams, ...newTeams],
      queue: [...session.queue, ...newTeams.map((t) => t.id)],
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
      id: crypto.randomUUID(), teamAId: teamA.id, teamBId: teamB.id,
      startedAt: null, endedAt: null, timerDuration: session.settings.timerDuration,
      isPaused: false, pausedAt: null, elapsedSeconds: 0,
      score: { teamA: 0, teamB: 0 }, winnerId: null,
      round: session.completedMatches.length + 1,
    };
    await onUpdate({ currentMatch: newMatch, queue: restQueue.map((t) => t.id) });
  }

  async function handleRenameTeam(teamId: string, newName: string) {
    await onUpdate({ teams: session.teams.map((t) => t.id === teamId ? { ...t, name: newName } : t) });
  }

  async function handleSwapPlayers(fromTeamId: string, fromPlayerId: string, toTeamId: string, toPlayerId: string | null) {
    if (fromTeamId === toTeamId) return;
    const updatedTeams = session.teams.map((t) => {
      if (toPlayerId !== null) {
        // Swap two players across teams
        if (t.id === fromTeamId) return { ...t, playerIds: t.playerIds.map((id) => id === fromPlayerId ? toPlayerId : id) };
        if (t.id === toTeamId) return { ...t, playerIds: t.playerIds.map((id) => id === toPlayerId ? fromPlayerId : id) };
      } else {
        // Move player to an empty spot on another team
        if (t.id === fromTeamId) return { ...t, playerIds: t.playerIds.filter((id) => id !== fromPlayerId) };
        if (t.id === toTeamId) return { ...t, playerIds: [...t.playerIds, fromPlayerId] };
      }
      return t;
    });
    await onUpdate({ teams: updatedTeams });
  }

  const tournamentDesc: Record<string, string> = {
    'king-of-court': `👑 King of the Court — Winner stays. After ${session.settings.consecutiveWinsToRest} consecutive wins, sit out ${session.settings.restRounds} ${session.settings.restRounds === 1 ? 'game' : 'games'}.`,
    'round-robin': '🔄 Round Robin — Every team plays every other team.',
    'elimination': '⚡ Single Elimination — Lose once, you\'re out.',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {/* Tournament / settings bar */}
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
            <button onClick={() => setEditingTimer(true)} className="flex items-center gap-1 text-sm" style={{ color: '#8892A4' }}>
              ⏱ {session.settings.timerDuration / 60} min <span className="text-xs ml-1" style={{ color: '#3D4557' }}>✎</span>
            </button>
          )}
          <span className="text-sm ml-auto" style={{ color: '#3D4557' }}>📋 {session.completedMatches.length} played</span>
        </div>
      </div>

      {/* Edit Lineup — collapsible drag-and-drop panel */}
      {session.teams.length > 0 && !isEnded && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--border)' }}>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: editMode ? 'rgba(255,107,0,0.07)' : 'var(--card)', borderBottom: editMode ? '1px solid var(--border)' : 'none' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: editMode ? 'var(--orange2)' : '#CDD5E0' }}>✎ Edit Lineup</span>
              <span className="text-[10px]" style={{ color: '#3D4557' }}>
                {session.teams.length} teams · {session.teams.reduce((n, t) => n + t.playerIds.length, 0)} players
              </span>
            </div>
            <span className="text-xs font-bold" style={{ color: '#3D4557' }}>{editMode ? '▲' : '▼'}</span>
          </button>
          {editMode && (
            <div className="p-4" style={{ background: 'var(--card)' }}>
              <TeamEditorPanel session={session} onSwap={handleSwapPlayers} />
            </div>
          )}
        </div>
      )}

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
            {queuedTeams.map((team, idx) => {
              const isDragging = draggingIdx === idx;
              const isOver = overIdx === idx && draggingIdx !== null && draggingIdx !== idx;
              const insertAbove = isOver && overIdx !== null && draggingIdx !== null && overIdx <= draggingIdx;
              const insertBelow = isOver && overIdx !== null && draggingIdx !== null && overIdx > draggingIdx;
              return (
                <div
                  key={team.id}
                  ref={(el) => { rowRefs.current[idx] = el; }}
                  className="flex items-stretch gap-2"
                  style={{
                    opacity: isDragging ? 0.35 : 1,
                    borderTop: insertAbove ? '2px solid var(--orange)' : '2px solid transparent',
                    borderBottom: insertBelow ? '2px solid var(--orange)' : '2px solid transparent',
                    transition: 'opacity 0.15s',
                  }}
                >
                  <button
                    className="flex items-center justify-center w-8 rounded-lg text-lg select-none flex-shrink-0"
                    style={{ touchAction: 'none', cursor: draggingIdx !== null ? 'grabbing' : 'grab', background: 'var(--surface)', border: '1px solid var(--border)', color: '#3D4557' }}
                    onPointerDown={(e) => handleDragPointerDown(idx, e)}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={handleDragPointerUp}
                    onPointerCancel={handleDragPointerUp}
                    title="Drag to reorder"
                  >
                    ⠿
                  </button>
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
              );
            })}
          </div>
        </div>
      )}

      {restingTeams.length > 0 && (
        <div>
          <SectionLabel count={restingTeams.length}>Resting</SectionLabel>
          <div className="flex flex-col gap-2 mt-2">
            {restingTeams.map((team) => <TeamCard key={team.id} team={team} session={session} onRename={(name) => handleRenameTeam(team.id, name)} />)}
          </div>
        </div>
      )}

      {idleTeams.length > 0 && (
        <div>
          <SectionLabel count={idleTeams.length}>Idle</SectionLabel>
          <div className="flex flex-col gap-2 mt-2">
            {idleTeams.map((team) => <TeamCard key={team.id} team={team} session={session} onRename={(name) => handleRenameTeam(team.id, name)} />)}
          </div>
        </div>
      )}

      {showCustomBuilder && !isEnded && (
        <CustomTeamBuilder session={session} onSave={handleSaveCustomTeams} onCancel={() => setShowCustomBuilder(false)} />
      )}

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
            className="w-full text-white font-bold text-base py-4 rounded-xl disabled:opacity-40 uppercase tracking-wide"
            style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 6px 20px rgba(255,107,0,0.3)' }}
          >
            {generating ? 'Generating…' : '⚡ Generate Balanced Teams'}
          </button>
          <button
            onClick={() => setShowCustomBuilder(true)}
            disabled={available.length < 2}
            className="w-full font-bold text-sm py-3 rounded-xl disabled:opacity-40 uppercase tracking-wide"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', color: '#CDD5E0' }}
          >
            ✏️ Build Custom Teams
          </button>
          {session.teams.length > 0 && (
            <button
              onClick={handleClearTeams}
              className="w-full font-bold text-sm py-3 rounded-xl uppercase tracking-wide transition-colors"
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
          <p className="text-base font-bold" style={{ color: '#8892A4' }}>No teams yet</p>
          <p className="text-sm mt-1">Add {playersPerTeam * 2}+ players and generate teams</p>
        </div>
      )}

      {!isEnded && (
        <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleEndSession}
            className="w-full font-bold text-sm py-3 rounded-xl uppercase tracking-wide transition-colors"
            style={
              confirmingEnd
                ? { background: '#DC2626', color: 'white' }
                : { background: 'transparent', border: '1.5px solid rgba(239,68,68,0.3)', color: '#F87171' }
            }
          >
            {confirmingEnd ? "⚠️ Confirm — End Today's Games?" : "🏁 End Day's Games"}
          </button>
          {confirmingEnd && (
            <button onClick={() => setConfirmingEnd(false)} className="w-full mt-2 text-sm py-2" style={{ color: '#3D4557' }}>Cancel</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

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
