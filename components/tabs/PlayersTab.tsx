'use client';

import { useState } from 'react';
import { Session, Player, Position } from '@/lib/types';
import { getPositionColor } from '@/lib/matching';

const ALL_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

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
          className={`text-2xl transition-transform active:scale-90 ${star <= value ? 'text-orange-400' : 'text-gray-600'}`}
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

  function togglePosition(pos: Position) {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : prev.length < 5 ? [...prev, pos] : prev
    );
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
    setName('');
    setPositions([]);
    setSkillLevel(3);
    setShowForm(false);
    setSaving(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    await onUpdate({ players: session.players.filter((p) => p.id !== id) });
    setRemovingId(null);
  }

  async function toggleAvailable(player: Player) {
    const updated = session.players.map((p) =>
      p.id === player.id ? { ...p, isAvailable: !p.isAvailable } : p
    );
    await onUpdate({ players: updated });
  }

  const available = session.players.filter((p) => p.isAvailable);
  const sittingOut = session.players.filter((p) => !p.isAvailable);
  const playersPerTeam = parseInt(session.settings.gameMode[0]);
  const teamsFromAvailable = Math.floor(available.length / playersPerTeam);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="flex gap-3">
        <div className="flex-1 bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
          <div className="text-2xl font-black text-orange-500">{session.players.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Total Players</div>
        </div>
        <div className="flex-1 bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
          <div className="text-2xl font-black text-green-400">{available.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Available</div>
        </div>
        <div className="flex-1 bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
          <div className="text-2xl font-black text-blue-400">{teamsFromAvailable}</div>
          <div className="text-xs text-gray-400 mt-0.5">Teams Possible</div>
        </div>
      </div>

      {/* Add player button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-bold text-lg py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-2xl">+</span> Add Player
        </button>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-4">
          <h3 className="font-bold text-white text-lg">New Player</h3>

          <input
            type="text"
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-orange-500 placeholder-gray-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Positions</label>
            <div className="flex flex-wrap gap-2">
              {ALL_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                    positions.includes(pos)
                      ? `${getPositionColor(pos)} text-white`
                      : 'bg-gray-700 text-gray-400 border border-gray-600'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">Tap all positions this player can play</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Skill Level</label>
            <StarRating value={skillLevel} onChange={setSkillLevel} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); setName(''); setPositions([]); setSkillLevel(3); }}
              className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-400 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Available players */}
      {available.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Available ({available.length})
          </h3>
          {available.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onRemove={() => handleRemove(player.id)}
              onToggleAvailable={() => toggleAvailable(player)}
              removing={removingId === player.id}
              editingId={editingId}
              setEditingId={setEditingId}
            />
          ))}
        </div>
      )}

      {/* Sitting out */}
      {sittingOut.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Sitting Out ({sittingOut.length})
          </h3>
          {sittingOut.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onRemove={() => handleRemove(player.id)}
              onToggleAvailable={() => toggleAvailable(player)}
              removing={removingId === player.id}
              editingId={editingId}
              setEditingId={setEditingId}
              dimmed
            />
          ))}
        </div>
      )}

      {session.players.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-lg font-medium">No players yet</p>
          <p className="text-sm mt-1">Add players to get started</p>
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player, onRemove, onToggleAvailable, removing, editingId, setEditingId, dimmed = false,
}: {
  player: Player;
  onRemove: () => void;
  onToggleAvailable: () => void;
  removing: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  dimmed?: boolean;
}) {
  const expanded = editingId === player.id;
  return (
    <div
      className={`bg-gray-800 border rounded-xl overflow-hidden transition-all ${
        dimmed ? 'border-gray-800 opacity-60' : 'border-gray-700'
      }`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setEditingId(expanded ? null : player.id)}
      >
        {/* Availability dot */}
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${player.isAvailable ? 'bg-green-400' : 'bg-gray-600'}`} />

        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-lg leading-tight truncate">{player.name}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {player.positions.map((pos) => (
              <span key={pos} className={`${getPositionColor(pos)} text-white text-xs font-bold px-2 py-0.5 rounded-md`}>
                {pos}
              </span>
            ))}
          </div>
        </div>

        <div className="text-orange-400 text-sm font-bold">
          {'★'.repeat(player.skillLevel)}{'☆'.repeat(5 - player.skillLevel)}
        </div>

        <div className="text-gray-500 text-lg">{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 px-4 py-3 flex gap-2">
          <button
            onClick={onToggleAvailable}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
              player.isAvailable
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
            }`}
          >
            {player.isAvailable ? '⏸ Sit Out' : '▶ Back In'}
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
          >
            {removing ? '...' : '🗑 Remove'}
          </button>
        </div>
      )}
    </div>
  );
}
