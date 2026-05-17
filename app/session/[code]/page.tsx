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
  { id: 'queue', label: 'Queue', icon: '📋' },
  { id: 'match', label: 'Match', icon: '⏱' },
  { id: 'history', label: 'History', icon: '📊' },
];

const POLL_MS = 5000;
// Sessions are cached in localStorage as a resilience layer against server cold-starts.
const cacheKey = (code: string) => `hoopup-session-${code}`;

function readCache(code: string): Session | null {
  try {
    const raw = localStorage.getItem(cacheKey(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeCache(code: string, session: Session) {
  try {
    localStorage.setItem(cacheKey(code), JSON.stringify(session));
  } catch {
    // Storage quota exceeded — silently ignore
  }
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

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${code}`, { cache: 'no-store' });
      if (!res.ok) {
        // Server lost the session (cold start / Redis miss) — keep showing cached data if we have it
        if (res.status === 404) {
          const cached = readCache(code);
          if (cached) {
            // Session gone from server but we have local data — keep showing it
            setLoading(false);
            return;
          }
          setError('Session not found');
        }
        setLoading(false);
        return;
      }
      const data: Session = await res.json();
      setSession(data);
      writeCache(code, data);
      setLoading(false);
    } catch {
      // Network failure — keep showing whatever we have
      setLoading(false);
    }
  }, [code]);

  // Initial load: show localStorage immediately, then sync from server
  useEffect(() => {
    const cached = readCache(code);
    if (cached) {
      setSession(cached);
      setLoading(false);
    }

    fetchSession();
    const interval = setInterval(fetchSession, POLL_MS);

    // Re-sync the moment the tab/screen becomes visible again (prevents stale state after lock)
    const handleVisibility = () => {
      if (!document.hidden) fetchSession();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchSession, code]);

  // Auto-switch to match tab when a match starts
  useEffect(() => {
    if (session?.currentMatch && activeTab === 'queue') {
      setActiveTab('match');
    }
  }, [session?.currentMatch, activeTab]);

  async function handleUpdate(updates: Partial<Session>) {
    if (!session) return;
    setSaving(true);
    // Optimistic update
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
      }
    } catch {
      // Revert on error
      setSession(session);
      writeCache(code, session);
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
        <div className="text-5xl animate-bounce">🏀</div>
        <p className="text-gray-400 text-lg font-medium">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-6">
        <div className="text-5xl">❌</div>
        <p className="text-white text-xl font-bold">Session not found</p>
        <p className="text-gray-400 text-center">The code &quot;{code}&quot; doesn&apos;t match any active session.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 bg-orange-500 text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-400 transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-lg p-1">
            ←
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-black text-white text-lg truncate">{session.settings.sessionName}</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">{session.settings.gameMode}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">{session.players.length} players</span>
              {saving && <span className="text-orange-400 text-xs">Saving...</span>}
              {session.status === 'completed' && (
                <span className="text-red-400 text-xs font-bold">· Ended</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
            >
              <span className="font-black text-white tracking-widest text-sm">{code}</span>
              <span className="text-gray-400 text-xs">{copied ? '✓' : '📋'}</span>
            </button>
            <button
              onClick={() => setShowQR(true)}
              className="w-9 h-9 bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg flex items-center justify-center text-lg transition-colors"
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
          {activeTab === 'queue' && <QueueTab session={session} onUpdate={handleUpdate} />}
          {activeTab === 'match' && <MatchTab session={session} onUpdate={handleUpdate} />}
          {activeTab === 'history' && <HistoryTab session={session} />}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-gray-950/95 backdrop-blur border-t border-gray-800 safe-area-bottom">
        <div className="flex max-w-lg mx-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const showDot = tab.id === 'match' && !!session.currentMatch;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative ${
                  isActive ? 'text-orange-500' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {showDot && (
                  <span className="absolute top-2 right-1/2 translate-x-3 w-2 h-2 bg-green-400 rounded-full" />
                )}
                <span className="text-2xl">{tab.icon}</span>
                <span className={`text-xs font-bold ${isActive ? 'text-orange-500' : ''}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-orange-500 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* QR Modal */}
      {showQR && (
        <QRModal
          code={code}
          sessionName={session.settings.sessionName}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}
