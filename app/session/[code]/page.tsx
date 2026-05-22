'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@/lib/types';
import PlayersTab from '@/components/tabs/PlayersTab';
import QueueTab from '@/components/tabs/QueueTab';
import MatchTab from '@/components/tabs/MatchTab';
import HistoryTab from '@/components/tabs/HistoryTab';
import QRModal from '@/components/QRModal';

type Tab = 'players' | 'queue' | 'match' | 'history';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'players', label: 'Players', icon: '👥' },
  { id: 'queue',   label: 'Queue',   icon: '📋' },
  { id: 'match',   label: 'Match',   icon: '⏱' },
  { id: 'history', label: 'Stats',   icon: '📊' },
];

const POLL_MS = 5000;
const cacheKey = (code: string) => `hoopup-session-${code}`;

function readCache(code: string): Session | null {
  try {
    const raw = localStorage.getItem(cacheKey(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch { return null; }
}

function writeCache(code: string, session: Session) {
  try { localStorage.setItem(cacheKey(code), JSON.stringify(session)); } catch { /* quota */ }
}

export default function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('players');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${code}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          const cached = readCache(code);
          if (cached) { setLoading(false); return; }
          setError('Session not found');
        }
        setLoading(false);
        return;
      }
      const data: Session = await res.json();
      setSession(data);
      writeCache(code, data);
      setLoading(false);
    } catch { setLoading(false); }
  }, [code]);

  useEffect(() => {
    const cached = readCache(code);
    if (cached) { setSession(cached); setLoading(false); }
    fetchSession();
    const interval = setInterval(fetchSession, POLL_MS);
    const handleVisibility = () => { if (!document.hidden) fetchSession(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [fetchSession, code]);

  useEffect(() => {
    if (session?.currentMatch && activeTab === 'queue') setActiveTab('match');
  }, [session?.currentMatch, activeTab]);

  async function handleUpdate(updates: Partial<Session>) {
    if (!session) return;
    setSaving(true);
    const optimistic = { ...session, ...updates };
    setSession(optimistic);
    writeCache(code, optimistic);
    try {
      const res = await fetch(`/api/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
        writeCache(code, updated);
      } else {
        setSession(session);
        writeCache(code, session);
        setSaveError(true);
        setTimeout(() => setSaveError(false), 3000);
      }
    } catch {
      setSession(session);
      writeCache(code, session);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl animate-bounce"
          style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 0 32px rgba(255,107,0,0.4)' }}
        >
          🏀
        </div>
        <p className="text-sm font-semibold tracking-widest uppercase" style={{ color: '#8892A4' }}>Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-6">
        <div className="text-6xl">❌</div>
        <p className="font-display text-3xl tracking-widest text-white">Session Not Found</p>
        <p className="text-center text-sm" style={{ color: '#8892A4' }}>The code &quot;{code}&quot; doesn&apos;t match any active session.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 text-white font-bold px-8 py-3 rounded-xl uppercase tracking-wide"
          style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)' }}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(8,9,14,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', color: '#8892A4' }}
          >
            ←
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-display text-xl tracking-widest text-white truncate leading-none">
              {session.settings.sessionName}
            </div>
            <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: '#8892A4' }}>
              <span>{session.settings.gameMode}</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span>{session.players.length} players</span>
              {saving && <span style={{ color: 'var(--orange2)' }}>· Saving…</span>}
              {saveError && <span className="text-red-400 font-bold">· Save failed</span>}
              {session.status === 'completed' && <span className="text-red-400 font-bold">· Ended</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
              style={{ background: copied ? 'rgba(255,107,0,0.12)' : 'var(--card)', border: `1.5px solid ${copied ? 'var(--orange)' : 'var(--border)'}` }}
            >
              <span
                className="font-black tracking-widest text-sm"
                style={{ color: copied ? 'var(--orange2)' : '#fff' }}
              >
                {code}
              </span>
              <span className="text-xs" style={{ color: '#8892A4' }}>{copied ? '✓' : '📋'}</span>
            </button>
            <button
              onClick={() => setShowQR(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors"
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            >
              📱
            </button>
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-4">
          {activeTab === 'players' && <PlayersTab session={session} onUpdate={handleUpdate} />}
          {activeTab === 'queue'   && <QueueTab   session={session} onUpdate={handleUpdate} />}
          {activeTab === 'match'   && <MatchTab   session={session} onUpdate={handleUpdate} />}
          {activeTab === 'history' && <HistoryTab session={session} />}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-10"
        style={{ background: 'rgba(8,9,14,0.96)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border)' }}
      >
        <div className="flex max-w-lg mx-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const showDot = tab.id === 'match' && !!session.currentMatch;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative"
                style={{ borderTop: `2px solid ${isActive ? 'var(--orange)' : 'transparent'}`, color: isActive ? 'var(--orange)' : '#3D4557' }}
              >
                {showDot && (
                  <span className="absolute top-2 right-1/2 translate-x-3 w-2 h-2 bg-green-400 rounded-full" style={{ boxShadow: '0 0 6px #22c55e' }} />
                )}
                <span className="text-xl">{tab.icon}</span>
                <span className="text-[9px] font-bold tracking-widest uppercase">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showQR && <QRModal code={code} sessionName={session.settings.sessionName} onClose={() => setShowQR(false)} />}
    </div>
  );
}
