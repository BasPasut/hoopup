'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameMode, TournamentType } from '@/lib/types';

const GAME_MODES: GameMode[] = ['3v3', '4v4', '5v5'];
const TOURNAMENT_TYPES: { value: TournamentType; label: string; desc: string }[] = [
  {
    value: 'king-of-court',
    label: '👑 King of the Court',
    desc: 'Winner stays. Win 2 in a row → sit out 1 round.',
  },
  {
    value: 'round-robin',
    label: '🔄 Round Robin',
    desc: 'Every team plays every other team once.',
  },
  {
    value: 'elimination',
    label: '⚡ Single Elimination',
    desc: "Lose once and you're out. Classic bracket.",
  },
];

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'home' | 'create' | 'join'>('home');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const [sessionName, setSessionName] = useState('Sunday Basketball');
  const [gameMode, setGameMode] = useState<GameMode>('5v5');
  const [tournamentType, setTournamentType] = useState<TournamentType>('king-of-court');
  const [timerMinutes, setTimerMinutes] = useState(8);
  const [winsToRest, setWinsToRest] = useState(2);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName,
          gameMode,
          tournamentType,
          timerDuration: timerMinutes * 60,
          consecutiveWinsToRest: winsToRest,
          restRounds: 1,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const session = await res.json();
      router.push(`/session/${session.code}`);
    } catch {
      setCreating(false);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setJoinError('Enter the 6-character code'); return; }
    setJoining(true);
    setJoinError('');
    const res = await fetch(`/api/sessions/${code}`);
    if (!res.ok) {
      setJoinError('Session not found. Check the code and try again.');
      setJoining(false);
      return;
    }
    router.push(`/session/${code}`);
  }

  if (view === 'home') {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh px-6 py-12 gap-8">
        <div className="text-center space-y-3">
          <div className="text-7xl">🏀</div>
          <h1 className="text-5xl font-black tracking-tight text-orange-500">HoopUp</h1>
          <p className="text-gray-400 text-lg max-w-xs mx-auto">
            Fair teams. Smart queues. No more arguments at the court.
          </p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={() => setView('create')}
            className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-bold text-xl py-5 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
          >
            Create Session
          </button>
          <button
            onClick={() => setView('join')}
            className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-900 text-white font-bold text-xl py-5 rounded-2xl transition-colors border border-gray-700"
          >
            Join with Code
          </button>
        </div>

        <div className="flex flex-wrap gap-2 justify-center max-w-sm">
          {['Fair team matching', 'Live timer', 'Queue management', 'Win stats', 'QR join'].map((f) => (
            <span key={f} className="text-xs bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full border border-gray-700">
              {f}
            </span>
          ))}
        </div>
      </main>
    );
  }

  if (view === 'join') {
    return (
      <main className="flex flex-col min-h-dvh px-6 py-12 gap-6">
        <button onClick={() => setView('home')} className="text-gray-400 hover:text-white flex items-center gap-2 w-fit text-lg">
          ← Back
        </button>
        <div>
          <h2 className="text-3xl font-black text-white">Join Session</h2>
          <p className="text-gray-400 mt-1">Enter the 6-character code from the host</p>
        </div>

        <div className="flex flex-col gap-4 max-w-sm">
          <input
            type="text"
            placeholder="ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-3xl font-black text-center tracking-widest text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          {joinError && <p className="text-red-400 text-sm text-center">{joinError}</p>}
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold text-xl py-4 rounded-2xl transition-colors"
          >
            {joining ? 'Joining...' : 'Join →'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-dvh px-6 py-12 gap-6 pb-24">
      <button onClick={() => setView('home')} className="text-gray-400 hover:text-white flex items-center gap-2 w-fit text-lg">
        ← Back
      </button>
      <div>
        <h2 className="text-3xl font-black text-white">New Session</h2>
        <p className="text-gray-400 mt-1">Set up your game</p>
      </div>

      <div className="flex flex-col gap-5 max-w-sm">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Session Name</label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Game Mode</label>
          <div className="flex gap-2">
            {GAME_MODES.map((m) => (
              <button
                key={m}
                onClick={() => setGameMode(m)}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-colors ${
                  gameMode === m
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Tournament Format</label>
          <div className="flex flex-col gap-2">
            {TOURNAMENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTournamentType(t.value)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  tournamentType === t.value
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                }`}
              >
                <div className="font-bold text-white">{t.label}</div>
                <div className="text-sm text-gray-400 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Match Timer</label>
          <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
            <button
              onClick={() => setTimerMinutes((v) => Math.max(1, v - 1))}
              className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center"
            >−</button>
            <span className="flex-1 text-center text-2xl font-black text-white">{timerMinutes} min</span>
            <button
              onClick={() => setTimerMinutes((v) => Math.min(30, v + 1))}
              className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center"
            >+</button>
          </div>
        </div>

        {tournamentType === 'king-of-court' && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Wins Before Rest</label>
            <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
              <button
                onClick={() => setWinsToRest((v) => Math.max(1, v - 1))}
                className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center"
              >−</button>
              <span className="flex-1 text-center text-2xl font-black text-white">{winsToRest} wins</span>
              <button
                onClick={() => setWinsToRest((v) => Math.min(5, v + 1))}
                className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center"
              >+</button>
            </div>
            <p className="text-xs text-gray-500">After {winsToRest} consecutive wins, team sits out 1 round</p>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold text-xl py-4 rounded-2xl transition-colors mt-2 shadow-lg shadow-orange-500/20"
        >
          {creating ? 'Creating...' : '🏀 Start Session'}
        </button>
      </div>
    </main>
  );
}
