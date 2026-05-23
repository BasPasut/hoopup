'use client';

import { useState, useRef } from 'react';
import { Session, Player, Position } from '@/lib/types';
import { getPositionColor } from '@/lib/matching';
import { parseAny } from '@/lib/import';

const ALL_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

const FAKE_NAMES = [
  'James L.', 'Kobe B.', 'Stephen C.', 'Kevin D.', 'LeBron J.',
  'Giannis A.', 'Luka D.', 'Jayson T.', 'Joel E.', 'Nikola J.',
  'Devin B.', 'Damian L.', 'Kawhi L.', 'Paul G.', 'Zion W.',
  'Anthony E.', 'Ja M.', 'Trae Y.', 'Donovan M.', 'Bam A.',
  'Chris P.', 'Rudy G.', 'Karl-Anthony T.', 'Draymond G.', 'Bradley B.',
  'Tyler H.', 'Khris M.', 'CJ M.', 'De\'Aaron F.', 'Shai G.',
];

function generateFakePlayers(count: number, existingCount: number): Player[] {
  const shuffled = [...FAKE_NAMES].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, i) => {
    const allPos: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
    const shuffledPos = allPos.sort(() => Math.random() - 0.5);
    const numPos = Math.floor(Math.random() * 2) + 1; // 1 or 2 positions
    return {
      id: crypto.randomUUID(),
      name: shuffled[i % shuffled.length] ?? `Player ${existingCount + i + 1}`,
      positions: shuffledPos.slice(0, numPos) as Position[],
      skillLevel: Math.floor(Math.random() * 5) + 1,
      isAvailable: true,
      stats: { gamesPlayed: 0, wins: 0 },
    };
  });
}

const AVATAR_COLORS = [
  { bg: 'rgba(255,107,0,0.15)', color: '#FF8C38' },
  { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
  { bg: 'rgba(34,197,94,0.1)', color: '#4ADE80' },
  { bg: 'rgba(168,85,247,0.12)', color: '#C084FC' },
  { bg: 'rgba(236,72,153,0.1)', color: '#F472B6' },
  { bg: 'rgba(6,182,212,0.1)', color: '#22D3EE' },
];

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

interface Props {
  session: Session;
  onUpdate: (updates: Partial<Session>) => Promise<void>;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className="text-2xl transition-transform active:scale-90"
          style={{ color: star <= value ? 'var(--orange)' : 'var(--border)' }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function PlayersTab({ session, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);
  const [skillLevel, setSkillLevel] = useState(3);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [devCount, setDevCount] = useState(10);
  const [devAdding, setDevAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importAdding, setImportAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSecretTap() {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowDevPanel((v) => !v);
      return;
    }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
  }

  async function handleDevAdd() {
    setDevAdding(true);
    const fake = generateFakePlayers(devCount, session.players.length);
    await onUpdate({ players: [...session.players, ...fake] });
    setDevAdding(false);
    setShowDevPanel(false);
  }

  function togglePosition(pos: Position) {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : prev.length < 5 ? [...prev, pos] : prev
    );
  }

  function getTemplate() {
    return `🏀 HoopUp – Player Registration\nSession: ${session.code}\n\nFill in YOUR details below and send back:\n───────────────────\nName: \nPosition: (PG / SG / SF / PF / C, leave blank = any)\nLevel: (1–5 stars, leave blank = 3 stars)\n───────────────────`;
  }

  async function copyTemplate() {
    await navigator.clipboard.writeText(getTemplate());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleImport() {
    const { players: newPlayers, sessionName } = parseAny(importText);
    if (newPlayers.length === 0) return;
    setImportAdding(true);
    const updates: Partial<Session> = { players: [...session.players, ...newPlayers] };
    if (sessionName) updates.settings = { ...session.settings, sessionName };
    await onUpdate(updates);
    setImportAdding(false);
    setImportText('');
    setShowImport(false);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      positions: positions.length > 0 ? positions : ['PG'],
      skillLevel,
      isAvailable: true,
      stats: { gamesPlayed: 0, wins: 0 },
    };
    await onUpdate({ players: [...session.players, newPlayer] });
    setName(''); setPositions([]); setSkillLevel(3); setShowForm(false); setSaving(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    await onUpdate({ players: session.players.filter((p) => p.id !== id) });
    setRemovingId(null);
  }

  async function toggleAvailable(player: Player) {
    const updated = session.players.map((p) => p.id === player.id ? { ...p, isAvailable: !p.isAvailable } : p);
    await onUpdate({ players: updated });
  }

  async function handleSavePlayer(updated: Player) {
    await onUpdate({ players: session.players.map((p) => p.id === updated.id ? updated : p) });
  }

  const available = session.players.filter((p) => p.isAvailable);
  const sittingOut = session.players.filter((p) => !p.isAvailable);
  const playersPerTeam = parseInt(session.settings.gameMode[0]);
  const teamsFromAvailable = Math.floor(available.length / playersPerTeam);

  return (
    <div className="flex flex-col gap-4">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { value: session.players.length, label: 'Total', color: 'var(--orange)' },
          { value: available.length,       label: 'Ready', color: '#4ADE80' },
          { value: teamsFromAvailable,     label: 'Teams',  color: '#60A5FA' },
        ].map(({ value, label, color }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            onClick={undefined}
          >
            <div className="font-display text-3xl leading-none" style={{ color }}>{value}</div>
            <div className="text-[10px] font-bold tracking-widest uppercase mt-1" style={{ color: '#3D4557' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Dev panel — double-tap Total to reveal */}
      {showDevPanel && (
        <div
          className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1.5px dashed rgba(168,85,247,0.3)' }}
        >
          <span className="text-xs font-bold" style={{ color: '#C084FC' }}>🧪 Add</span>
          <button
            onClick={() => setDevCount((v) => Math.max(1, v - 1))}
            className="w-7 h-7 rounded-lg font-bold text-white flex items-center justify-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >−</button>
          <span className="font-black text-white w-6 text-center">{devCount}</span>
          <button
            onClick={() => setDevCount((v) => Math.min(30, v + 1))}
            className="w-7 h-7 rounded-lg font-bold text-white flex items-center justify-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >+</button>
          <span className="text-xs" style={{ color: '#C084FC' }}>fake players</span>
          <button
            onClick={handleDevAdd}
            disabled={devAdding}
            className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: 'rgba(168,85,247,0.4)', border: '1px solid rgba(168,85,247,0.5)' }}
          >
            {devAdding ? '...' : 'Add'}
          </button>
        </div>
      )}

      {/* Add player */}
      {!showForm && !showImport ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="w-full text-white font-bold text-base py-4 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
            style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 6px 20px rgba(255,107,0,0.3)' }}
          >
            <span className="text-xl font-black">+</span> Add Player
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="w-full font-bold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', color: '#8892A4' }}
          >
            Import from LINE
          </button>
        </div>
      ) : showImport ? (
        <ImportPanel
          session={session}
          importText={importText}
          setImportText={setImportText}
          importAdding={importAdding}
          copied={copied}
          onCopyTemplate={copyTemplate}
          onImport={handleImport}
          onClose={() => { setShowImport(false); setImportText(''); }}
        />
      ) : (
        <div className="rounded-2xl p-4 flex flex-col gap-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl tracking-widest text-white">New Player</h3>
            <button onClick={() => { setShowForm(false); setName(''); setPositions([]); setSkillLevel(3); }} className="text-2xl" style={{ color: '#3D4557' }}>×</button>
          </div>

          <input
            type="text"
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none placeholder-gray-600"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>Positions</label>
            <div className="flex flex-wrap gap-2">
              {ALL_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  className="px-3 py-2 rounded-lg font-bold text-sm transition-all"
                  style={
                    positions.includes(pos)
                      ? { background: 'rgba(255,107,0,0.15)', border: '1.5px solid var(--orange)', color: 'var(--orange2)' }
                      : { background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }
                  }
                >
                  {pos}
                </button>
              ))}
            </div>
            <p className="text-[10px]" style={{ color: '#3D4557' }}>Tap all positions this player can play</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>Skill Level</label>
            <StarRating value={skillLevel} onChange={setSkillLevel} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); setName(''); setPositions([]); setSkillLevel(3); }}
              className="flex-1 py-3 rounded-xl font-bold transition-all"
              style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !name.trim()}
              className="flex-1 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)' }}
            >
              {saving ? 'Adding...' : 'Add Player'}
            </button>
          </div>
        </div>
      )}

      {/* Available players */}
      {available.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel count={available.length}>Available</SectionLabel>
          {available.map((player) => (
            <PlayerCard key={player.id} player={player} onRemove={() => handleRemove(player.id)} onToggleAvailable={() => toggleAvailable(player)} onSave={handleSavePlayer} removing={removingId === player.id} editingId={editingId} setEditingId={setEditingId} />
          ))}
        </div>
      )}

      {/* Sitting out */}
      {sittingOut.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel count={sittingOut.length}>Sitting Out</SectionLabel>
          {sittingOut.map((player) => (
            <PlayerCard key={player.id} player={player} onRemove={() => handleRemove(player.id)} onToggleAvailable={() => toggleAvailable(player)} onSave={handleSavePlayer} removing={removingId === player.id} editingId={editingId} setEditingId={setEditingId} dimmed />
          ))}
        </div>
      )}

      {session.players.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-14" style={{ color: '#3D4557' }}>
          <div className="text-5xl mb-3 cursor-default select-none" onDoubleClick={() => setShowDevPanel((v) => !v)}>👥</div>
          <p className="text-base font-bold">No players yet</p>
          <p className="text-sm mt-1">Add players to get started</p>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#3D4557' }}>{children}</span>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)', color: 'var(--orange2)' }}
      >
        {count}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}

function PlayerCard({
  player, onRemove, onToggleAvailable, onSave, removing, editingId, setEditingId, dimmed = false,
}: {
  player: Player; onRemove: () => void; onToggleAvailable: () => void; onSave: (p: Player) => void;
  removing: boolean; editingId: string | null; setEditingId: (id: string | null) => void; dimmed?: boolean;
}) {
  const expanded = editingId === player.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(player.name);
  const [editPositions, setEditPositions] = useState<Position[]>(player.positions);
  const [editSkillLevel, setEditSkillLevel] = useState(player.skillLevel);
  const avatar = getAvatarColor(player.name);

  function startEdit() {
    setEditName(player.name);
    setEditPositions(player.positions);
    setEditSkillLevel(player.skillLevel);
    setIsEditing(true);
  }

  function cancelEdit() { setIsEditing(false); }

  function saveEdit() {
    if (!editName.trim()) return;
    onSave({ ...player, name: editName.trim(), positions: editPositions.length > 0 ? editPositions : [...ALL_POSITIONS], skillLevel: editSkillLevel });
    setIsEditing(false);
    setEditingId(null);
  }

  function toggleEditPos(pos: Position) {
    setEditPositions((prev) => prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]);
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: 'var(--card)', border: `1.5px solid ${dimmed ? 'var(--surface)' : 'var(--border)'}`, opacity: dimmed ? 0.55 : 1 }}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => { setIsEditing(false); setEditingId(expanded ? null : player.id); }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
          style={{ background: avatar.bg, color: avatar.color }}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-base leading-tight truncate">{player.name}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {player.positions.map((pos) => (
              <span key={pos} className={`${getPositionColor(pos)} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md`}>
                {pos}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold" style={{ color: 'var(--orange)' }}>
            {'★'.repeat(player.skillLevel)}<span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - player.skillLevel)}</span>
          </span>
          <span className="text-xs" style={{ color: '#3D4557' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && !isEditing && (
        <div className="flex gap-2 px-3 pb-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <button
            onClick={onToggleAvailable}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all"
            style={
              player.isAvailable
                ? { background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }
                : { background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.3)', color: '#4ADE80' }
            }
          >
            {player.isAvailable ? '⏸ Sit Out' : '▶ Back In'}
          </button>
          <button
            onClick={startEdit}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1.5px solid rgba(96,165,250,0.25)', color: '#60A5FA' }}
          >
            ✏ Edit
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: '#F87171' }}
          >
            {removing ? '...' : '🗑'}
          </button>
        </div>
      )}

      {expanded && isEditing && (
        <div className="px-3 pb-3 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-white font-semibold text-sm focus:outline-none"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>Positions</span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => toggleEditPos(pos)}
                  className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all"
                  style={
                    editPositions.includes(pos)
                      ? { background: 'rgba(255,107,0,0.15)', border: '1.5px solid var(--orange)', color: 'var(--orange2)' }
                      : { background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }
                  }
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>Skill Level</span>
            <StarRating value={editSkillLevel} onChange={setEditSkillLevel} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="flex-1 py-2.5 rounded-lg font-bold text-sm"
              style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={!editName.trim()}
              className="flex-1 py-2.5 rounded-lg font-bold text-sm text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)' }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportPanel({
  session, importText, setImportText, importAdding, copied, onCopyTemplate, onImport, onClose,
}: {
  session: Session;
  importText: string;
  setImportText: (v: string) => void;
  importAdding: boolean;
  copied: boolean;
  onCopyTemplate: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const { players: parsed, sessionName: detectedSessionName } = parseAny(importText);
  const template = `🏀 HoopUp – Player Registration\nSession: ${session.code}\n\nFill in YOUR details below and send back:\n───────────────────\nName: \nPosition: (PG / SG / SF / PF / C, leave blank = any)\nLevel: (1–5 stars, leave blank = 3 stars)\n───────────────────`;

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl tracking-widest text-white">Import from LINE</h3>
        <button onClick={onClose} className="text-2xl" style={{ color: '#3D4557' }}>×</button>
      </div>

      {/* Step 1: Copy template */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>Step 1 — Copy & share in LINE group</label>
        <div
          className="rounded-xl p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}
        >
          {template}
        </div>
        <button
          onClick={onCopyTemplate}
          className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
          style={
            copied
              ? { background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)', color: '#4ADE80' }
              : { background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }
          }
        >
          {copied ? 'Copied!' : 'Copy Template'}
        </button>
      </div>

      {/* Step 2: Paste replies */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>Step 2 — Paste player list here</label>
        <p className="text-[10px]" style={{ color: '#3D4557' }}>Works with HoopUp replies or a LINE numbered list (e.g. เปิดตี้: Sunday · 1.ติ · 2.นพ)</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={`เปิดตี้: Sunday 25 May\n1.ติ\n2.นพ\n3.บอส\nนาย\n5.อั๋น\n\n— or HoopUp format —\n\nName: John\nPosition: PG SG\nLevel: 4`}
          rows={9}
          className="w-full rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none placeholder-gray-600 resize-none"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        {importText.trim() && (
          <div className="flex flex-col gap-1">
            {detectedSessionName && (
              <p className="text-xs font-bold" style={{ color: '#60A5FA' }}>
                Session name: {detectedSessionName}
              </p>
            )}
            <p className="text-xs font-bold" style={{ color: parsed.length > 0 ? '#4ADE80' : '#F87171' }}>
              {parsed.length > 0
                ? `${parsed.length} player${parsed.length > 1 ? 's' : ''} detected: ${parsed.map((p) => p.name).join(', ')}`
                : 'No valid players found'}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl font-bold transition-all"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: '#8892A4' }}
        >
          Cancel
        </button>
        <button
          onClick={onImport}
          disabled={importAdding || parsed.length === 0}
          className="flex-1 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)' }}
        >
          {importAdding ? 'Adding...' : `Add ${parsed.length > 0 ? parsed.length : ''} Player${parsed.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
