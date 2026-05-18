'use client';

import { useState } from 'react';
import { Session, Match } from '@/lib/types';

interface Props {
  session: Session;
  onClose: () => void;
}

function calcDuration(match: Match): number {
  if (!match.endedAt || !match.startedAt) return match.elapsedSeconds;
  return (new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime()) / 1000 + match.elapsedSeconds;
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ReportModal({ session, onClose }: Props) {
  const [exporting, setExporting] = useState(false);

  const matches = [...session.completedMatches].reverse();

  const teamStats = [...session.teams]
    .filter((t) => t.stats.gamesPlayed > 0)
    .sort((a, b) => b.stats.wins - a.stats.wins);

  const totalSecs = matches.reduce((s, m) => s + calcDuration(m), 0);
  const avgSecs = matches.length > 0 ? totalSecs / matches.length : 0;
  const champion = teamStats[0];

  const dateStr = new Date(session.createdAt).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  async function handleExportImage() {
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const el = document.getElementById('hoopup-report');
      if (!el) return;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoopup-${session.settings.sessionName.replace(/\s+/g, '-')}-${session.date}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Scroll container */}
      <div className="fixed inset-0 z-[60] overflow-y-auto">
        <div className="min-h-full px-3 py-6 pb-32 flex justify-center">

          <div id="hoopup-report" className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl">

            {/* ── Header ── */}
            <div
              style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)', printColorAdjust: 'exact' }}
              className="relative px-6 pt-8 pb-7 text-white overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 text-9xl opacity-10 select-none pointer-events-none">🏀</div>
              <div className="absolute right-10 bottom-2 text-6xl opacity-10 select-none pointer-events-none">🏀</div>

              <div className="text-5xl mb-2">🏀</div>
              <h1 className="text-3xl font-black tracking-tight leading-tight">{session.settings.sessionName}</h1>
              <p className="text-orange-100 text-sm mt-1">{dateStr}</p>
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-orange-200">
                <span className="bg-white/15 px-2 py-0.5 rounded-full">{session.settings.gameMode}</span>
                <span className="bg-white/15 px-2 py-0.5 rounded-full capitalize">{session.settings.tournamentType.replace(/-/g, ' ')}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5">
                {[
                  { icon: '⚡', value: matches.length, label: 'Matches' },
                  { icon: '👥', value: session.players.length, label: 'Players' },
                  { icon: '⏱', value: avgSecs > 0 ? `${Math.floor(avgSecs / 60)}m` : '—', label: 'Avg Match' },
                ].map((s) => (
                  <div key={s.label} className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                    <div className="text-xl mb-0.5">{s.icon}</div>
                    <div className="text-2xl font-black">{s.value}</div>
                    <div className="text-xs text-orange-100 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 flex flex-col gap-7">

              {/* ── Champion banner ── */}
              {champion && (
                <div
                  style={{ background: 'linear-gradient(135deg, #fefce8, #fff7ed)', printColorAdjust: 'exact' }}
                  className="border border-yellow-200 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="text-5xl">🏆</div>
                  <div>
                    <div className="text-xs font-black text-yellow-600 uppercase tracking-widest">Today&apos;s Champion</div>
                    <div className="text-2xl font-black text-gray-900 mt-0.5">{champion.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {champion.stats.wins}W · {champion.stats.losses}L ·{' '}
                      {Math.round((champion.stats.wins / champion.stats.gamesPlayed) * 100)}% win rate
                    </div>
                  </div>
                </div>
              )}

              {/* ── Team standings ── */}
              {teamStats.length > 0 && (
                <div>
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">🏀 Team Standings</h2>
                  <div className="rounded-2xl overflow-hidden border border-gray-100">
                    <div
                      className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-black text-gray-400 uppercase tracking-wider"
                      style={{ backgroundColor: '#f9fafb', printColorAdjust: 'exact' }}
                    >
                      <div className="col-span-1">#</div>
                      <div className="col-span-5">Team</div>
                      <div className="col-span-2 text-center">W</div>
                      <div className="col-span-2 text-center">L</div>
                      <div className="col-span-2 text-right">Win%</div>
                    </div>
                    {teamStats.map((team, idx) => {
                      const pct = team.stats.gamesPlayed > 0
                        ? Math.round((team.stats.wins / team.stats.gamesPlayed) * 100)
                        : 0;
                      return (
                        <div
                          key={team.id}
                          className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-t border-gray-100"
                          style={{ backgroundColor: idx === 0 ? '#fff7ed' : 'white', printColorAdjust: 'exact' }}
                        >
                          <div className="col-span-1 text-sm font-black text-gray-400">{idx + 1}</div>
                          <div className="col-span-5 font-black text-gray-900 text-sm flex items-center gap-1">
                            {idx === 0 && <span>👑</span>}
                            {team.name}
                          </div>
                          <div className="col-span-2 text-center font-black text-green-600">{team.stats.wins}</div>
                          <div className="col-span-2 text-center font-bold text-red-400">{team.stats.losses}</div>
                          <div className="col-span-2 text-right">
                            <span
                              className="text-xs font-black px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: pct >= 60 ? '#dcfce7' : pct >= 40 ? '#fef9c3' : '#fee2e2',
                                color: pct >= 60 ? '#16a34a' : pct >= 40 ? '#ca8a04' : '#dc2626',
                                printColorAdjust: 'exact',
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Match results ── */}
              {matches.length > 0 && (
                <div>
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                    📋 Match Results ({matches.length})
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {matches.map((match) => {
                      const tA = session.teams.find((t) => t.id === match.teamAId);
                      const tB = session.teams.find((t) => t.id === match.teamBId);
                      const aWon = match.winnerId === match.teamAId;
                      const bWon = match.winnerId === match.teamBId;
                      const isDraw = match.endedAt !== null && match.winnerId === null;
                      const dur = calcDuration(match);

                      return (
                        <div
                          key={match.id}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                          style={{ backgroundColor: '#f9fafb', printColorAdjust: 'exact' }}
                        >
                          <span className="text-xs font-bold text-gray-400 w-10 flex-shrink-0">#{match.round}</span>

                          <div className="flex-1 flex items-center gap-2">
                            <span className="flex-1 text-right text-sm font-black" style={{ color: aWon ? '#16a34a' : isDraw ? '#d97706' : '#9ca3af' }}>
                              {tA?.name ?? '—'}
                            </span>
                            <div
                              className="flex items-center gap-1 px-3 py-1 rounded-xl flex-shrink-0"
                              style={{ backgroundColor: isDraw ? '#78350f' : '#1f2937', printColorAdjust: 'exact' }}
                            >
                              <span className="text-base font-black" style={{ color: aWon ? '#4ade80' : isDraw ? '#fbbf24' : 'white' }}>{match.score.teamA}</span>
                              <span className="text-gray-500 text-xs mx-0.5">{isDraw ? '=' : ':'}</span>
                              <span className="text-base font-black" style={{ color: bWon ? '#4ade80' : isDraw ? '#fbbf24' : 'white' }}>{match.score.teamB}</span>
                            </div>
                            <span className="flex-1 text-sm font-black" style={{ color: bWon ? '#16a34a' : isDraw ? '#d97706' : '#9ca3af' }}>
                              {tB?.name ?? '—'}
                            </span>
                          </div>

                          <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">
                            {dur > 0 ? fmtTime(dur) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Footer / Ad ── */}
              <div className="flex flex-col items-center gap-1.5 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏀</span>
                  <span className="text-lg font-black text-gray-800">HoopUp</span>
                </div>
                <p className="text-xs text-gray-400">Pickup basketball, organised.</p>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-0.5"
                  style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', printColorAdjust: 'exact' }}
                >
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Try it free →</span>
                  <span className="text-[10px] font-bold text-orange-400">hoopup-gang.vercel.app</span>
                </div>
                <p className="text-[10px] text-gray-300 mt-1">Generated {new Date().toLocaleDateString()}</p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-6 left-0 right-0 z-[70] flex justify-center gap-3 px-4">
        <button
          onClick={handleExportImage}
          disabled={exporting}
          className="text-white font-black px-7 py-4 rounded-2xl shadow-2xl text-base transition-colors disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 8px 24px rgba(255,107,0,0.4)' }}
        >
          {exporting ? '⏳ Exporting...' : '🖼 Save as Image'}
        </button>
        <button
          onClick={onClose}
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-4 rounded-2xl shadow-xl transition-colors"
        >
          ✕ Close
        </button>
      </div>
    </>
  );
}
