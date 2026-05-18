'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameMode, TournamentType, ScoreMode } from '@/lib/types';

const GAME_MODES: GameMode[] = ['3v3', '4v4', '5v5'];
const TOURNAMENT_TYPES: { value: TournamentType; label: string; desc: string; icon: string }[] = [
  { value: 'king-of-court', icon: '👑', label: 'King of the Court', desc: 'Winner stays. Win 2 in a row → sit out 1 round.' },
  { value: 'round-robin',   icon: '🔄', label: 'Round Robin',        desc: 'Every team plays every other team once.' },
  { value: 'elimination',   icon: '⚡', label: 'Single Elimination', desc: "Lose once and you're out. Classic bracket." },
];

const FEATURES = ['Fair Matching', 'Live Timer', 'Queue Mgmt', 'Win Stats', 'QR Join'];

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
  const [scoreMode, setScoreMode] = useState<ScoreMode>('1-2');
  const [scoreToWinEnabled, setScoreToWinEnabled] = useState(false);
  const [scoreToWin, setScoreToWin] = useState(11);

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
          scoreMode,
          scoreToWin: scoreToWinEnabled ? scoreToWin : null,
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

  /* ── Home ── */
  if (view === 'home') {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh px-6 py-12 gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
            style={{
              background: 'linear-gradient(135deg, #FF6B00, #FF8C38)',
              boxShadow: '0 0 0 1px rgba(255,107,0,0.3), 0 20px 48px rgba(255,107,0,0.35)',
            }}
          >
            🏀
          </div>
          <div className="text-center">
            <h1
              className="font-display text-6xl tracking-widest"
              style={{ background: 'linear-gradient(180deg,#fff 40%,rgba(255,255,255,0.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              HoopUp
            </h1>
            <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              Fair teams. Smart queues. No more arguments at the court.
            </p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center max-w-xs">
          {FEATURES.map((f) => (
            <span
              key={f}
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)', color: '#FF8C38' }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={() => setView('create')}
            className="w-full text-white font-bold text-lg py-5 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-wide"
            style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 8px 28px rgba(255,107,0,0.4)' }}
          >
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-black"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              +
            </span>
            Create Session
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--border)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <button
            onClick={() => setView('join')}
            className="w-full font-bold text-lg py-5 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-wide"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', color: '#CDD5E0' }}
          >
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'var(--surface)' }}
            >
              #
            </span>
            Join with Code
          </button>
        </div>
      </main>
    );
  }

  /* ── Join ── */
  if (view === 'join') {
    return (
      <main className="flex flex-col min-h-dvh px-6 py-12 gap-6">
        <button onClick={() => setView('home')} className="flex items-center gap-2 w-fit text-sm font-semibold uppercase tracking-widest" style={{ color: '#8892A4' }}>
          ← Back
        </button>
        <div>
          <h2 className="font-display text-4xl tracking-widest text-white">Join Session</h2>
          <p className="text-sm mt-1" style={{ color: '#8892A4' }}>Enter the 6-character code from the host</p>
        </div>

        <div className="flex flex-col gap-4 max-w-sm">
          <input
            type="text"
            placeholder="ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            className="w-full rounded-2xl px-5 py-5 text-4xl font-black text-center tracking-[0.3em] text-white placeholder-gray-600 focus:outline-none"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          {joinError && <p className="text-red-400 text-sm text-center">{joinError}</p>}
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full text-white font-bold text-lg py-5 rounded-2xl transition-all disabled:opacity-50 uppercase tracking-wide"
            style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 8px 24px rgba(255,107,0,0.35)' }}
          >
            {joining ? 'Joining...' : 'Join →'}
          </button>
        </div>
      </main>
    );
  }

  /* ── Create ── */
  return (
    <main className="flex flex-col min-h-dvh px-5 py-12 gap-6 pb-28">
      <button onClick={() => setView('home')} className="flex items-center gap-2 w-fit text-sm font-semibold uppercase tracking-widest" style={{ color: '#8892A4' }}>
        ← Back
      </button>
      <div>
        <h2 className="font-display text-4xl tracking-widest text-white">New Session</h2>
        <p className="text-sm mt-1" style={{ color: '#8892A4' }}>Set up your game</p>
      </div>

      <div className="flex flex-col gap-6 max-w-sm">

        {/* Session name */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Session Name</SectionLabel>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-white font-semibold text-base focus:outline-none"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Game mode */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Game Mode</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {GAME_MODES.map((m) => (
              <button
                key={m}
                onClick={() => setGameMode(m)}
                className="py-4 rounded-xl font-black text-xl transition-all flex flex-col items-center gap-0.5"
                style={
                  gameMode === m
                    ? { background: 'rgba(255,107,0,0.1)', border: '1.5px solid var(--orange)', color: 'var(--orange)', boxShadow: 'inset 0 0 24px rgba(255,107,0,0.06)' }
                    : { background: 'var(--card)', border: '1.5px solid var(--border)', color: '#8892A4' }
                }
              >
                {m}
                <span className="text-[9px] font-semibold tracking-widest uppercase opacity-70">
                  {m === '3v3' ? 'Half' : m === '4v4' ? 'Standard' : 'Full'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tournament format */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Tournament Format</SectionLabel>
          <div className="flex flex-col gap-2">
            {TOURNAMENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTournamentType(t.value)}
                className="text-left p-4 rounded-xl transition-all flex items-start gap-3"
                style={
                  tournamentType === t.value
                    ? { background: 'rgba(255,107,0,0.08)', border: '1.5px solid var(--orange)' }
                    : { background: 'var(--card)', border: '1.5px solid var(--border)' }
                }
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: tournamentType === t.value ? 'rgba(255,107,0,0.15)' : 'var(--surface)' }}
                >
                  {t.icon}
                </span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{t.label}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: '#8892A4' }}>{t.desc}</div>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center"
                  style={{ borderColor: tournamentType === t.value ? 'var(--orange)' : 'var(--border)', background: tournamentType === t.value ? 'var(--orange)' : 'transparent' }}
                >
                  {tournamentType === t.value && <span className="w-2 h-2 rounded-full bg-white block" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Match Timer</SectionLabel>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <Stepper onClick={() => setTimerMinutes((v) => Math.max(1, v - 1))}>−</Stepper>
            <span className="flex-1 text-center text-3xl font-black text-white tabular-nums">
              {timerMinutes} <span className="text-base font-semibold" style={{ color: '#8892A4' }}>MIN</span>
            </span>
            <Stepper onClick={() => setTimerMinutes((v) => Math.min(30, v + 1))}>+</Stepper>
          </div>
        </div>

        {/* Wins before rest */}
        {/* Score mode */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Score Per Basket</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(['1-2', '2-3'] as ScoreMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setScoreMode(mode)}
                className="py-4 rounded-xl font-black text-lg transition-all flex flex-col items-center gap-0.5"
                style={
                  scoreMode === mode
                    ? { background: 'rgba(255,107,0,0.1)', border: '1.5px solid var(--orange)', color: 'var(--orange)' }
                    : { background: 'var(--card)', border: '1.5px solid var(--border)', color: '#8892A4' }
                }
              >
                {mode === '1-2' ? '1 / 2' : '2 / 3'}
                <span className="text-[9px] font-semibold tracking-widest uppercase opacity-70">
                  {mode === '1-2' ? 'Regular' : 'Basketball'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Score to win */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <SectionLabel>Score to Win</SectionLabel>
            <button
              onClick={() => setScoreToWinEnabled((v) => !v)}
              className="ml-auto text-[10px] font-bold px-3 py-1 rounded-full transition-all"
              style={
                scoreToWinEnabled
                  ? { background: 'rgba(255,107,0,0.15)', border: '1px solid var(--orange)', color: 'var(--orange2)' }
                  : { background: 'var(--surface)', border: '1px solid var(--border)', color: '#3D4557' }
              }
            >
              {scoreToWinEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {scoreToWinEnabled && (
            <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <Stepper onClick={() => setScoreToWin((v) => Math.max(1, v - 1))}>−</Stepper>
              <span className="flex-1 text-center text-3xl font-black text-white tabular-nums">
                {scoreToWin} <span className="text-base font-semibold" style={{ color: '#8892A4' }}>PTS</span>
              </span>
              <Stepper onClick={() => setScoreToWin((v) => v + 1)}>+</Stepper>
            </div>
          )}
          {!scoreToWinEnabled && (
            <p className="text-[10px]" style={{ color: '#3D4557' }}>Game ends by timer only</p>
          )}
        </div>

        {tournamentType === 'king-of-court' && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Wins Before Rest</SectionLabel>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <Stepper onClick={() => setWinsToRest((v) => Math.max(1, v - 1))}>−</Stepper>
              <span className="flex-1 text-center text-3xl font-black text-white tabular-nums">
                {winsToRest} <span className="text-base font-semibold" style={{ color: '#8892A4' }}>WINS</span>
              </span>
              <Stepper onClick={() => setWinsToRest((v) => Math.min(5, v + 1))}>+</Stepper>
            </div>
            <p className="text-xs" style={{ color: '#3D4557' }}>After {winsToRest} consecutive wins, team sits out 1 round</p>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full text-white font-bold text-lg py-5 rounded-2xl transition-all disabled:opacity-50 uppercase tracking-wide flex items-center justify-center gap-3 mt-2"
          style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 8px 28px rgba(255,107,0,0.4)' }}
        >
          <span>🏀</span>
          {creating ? 'Creating...' : 'Start Session'}
        </button>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#3D4557' }}>{children}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}

function Stepper({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl font-bold text-white transition-colors"
      style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
    >
      {children}
    </button>
  );
}
