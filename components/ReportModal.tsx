'use client';

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

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const PODIUM_HEIGHT: Record<number, string> = { 1: '80px', 2: '56px', 3: '40px' };
const PODIUM_COLOR: Record<number, string> = { 1: '#f59e0b', 2: '#9ca3af', 3: '#fb923c' };

export default function ReportModal({ session, onClose }: Props) {
  const matches = [...session.completedMatches].reverse();

  const playerStats = session.players
    .map((p) => ({
      player: p,
      wins: p.stats.wins,
      gamesPlayed: p.stats.gamesPlayed,
      winRate: p.stats.gamesPlayed > 0 ? p.stats.wins / p.stats.gamesPlayed : 0,
    }))
    .filter((ps) => ps.gamesPlayed > 0)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  const teamStats = [...session.teams]
    .filter((t) => t.stats.gamesPlayed > 0)
    .sort((a, b) => b.stats.wins - a.stats.wins);

  const totalSecs = matches.reduce((s, m) => s + calcDuration(m), 0);
  const avgSecs = matches.length > 0 ? totalSecs / matches.length : 0;

  const champion = teamStats[0];
  const mvp = playerStats[0];
  const top3 = playerStats.slice(0, 3);
  // podium visual order: 2nd · 1st · 3rd
  const podiumOrder =
    top3.length === 3
      ? [{ ps: top3[1], place: 2 }, { ps: top3[0], place: 1 }, { ps: top3[2], place: 3 }]
      : top3.length === 2
      ? [{ ps: top3[1], place: 2 }, { ps: top3[0], place: 1 }]
      : top3.map((ps, i) => ({ ps, place: i + 1 }));

  const dateStr = new Date(session.createdAt).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #hoopup-report, #hoopup-report * { visibility: visible !important; }
          #hoopup-report {
            position: fixed !important;
            inset: 0 !important;
            overflow: auto !important;
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Backdrop */}
      <div className="no-print fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Scroll container */}
      <div className="fixed inset-0 z-[60] overflow-y-auto">
        <div className="min-h-full px-3 py-6 pb-32 flex justify-center">

          <div id="hoopup-report" className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl">

            {/* ── Header ── */}
            <div
              style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)', printColorAdjust: 'exact' }}
              className="relative px-6 pt-8 pb-7 text-white overflow-hidden"
            >
              {/* Decorative balls */}
              <div className="absolute -right-6 -top-6 text-9xl opacity-10 select-none pointer-events-none">🏀</div>
              <div className="absolute right-10 bottom-2 text-6xl opacity-10 select-none pointer-events-none">🏀</div>

              <div className="text-5xl mb-2">🏀</div>
              <h1 className="text-3xl font-black tracking-tight leading-tight">{session.settings.sessionName}</h1>
              <p className="text-orange-100 text-sm mt-1">{dateStr}</p>
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-orange-200">
                <span className="bg-white/15 px-2 py-0.5 rounded-full">{session.settings.gameMode}</span>
                <span className="bg-white/15 px-2 py-0.5 rounded-full capitalize">{session.settings.tournamentType.replace(/-/g, ' ')}</span>
              </div>

              {/* Hero stats */}
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
                    <div className="text-xs font-black text-yellow-600 uppercase tracking-widest">Today's Champion</div>
                    <div className="text-2xl font-black text-gray-900 mt-0.5">{champion.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {champion.stats.wins}W · {champion.stats.losses}L ·{' '}
                      {Math.round((champion.stats.wins / champion.stats.gamesPlayed) * 100)}% win rate
                    </div>
                  </div>
                </div>
              )}

              {/* ── MVP callout ── */}
              {mvp && (
                <div
                  style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', printColorAdjust: 'exact' }}
                  className="border border-orange-200 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="text-5xl">⭐</div>
                  <div>
                    <div className="text-xs font-black text-orange-500 uppercase tracking-widest">MVP</div>
                    <div className="text-2xl font-black text-gray-900 mt-0.5">{mvp.player.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {mvp.wins} wins · {mvp.gamesPlayed} games · {Math.round(mvp.winRate * 100)}% win rate
                    </div>
                  </div>
                </div>
              )}

              {/* ── Podium ── */}
              {podiumOrder.length >= 2 && (
                <div>
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">🎖 Top Players Podium</h2>
                  <div className="flex items-end justify-center gap-4">
                    {podiumOrder.map(({ ps, place }) => (
                      <div key={ps.player.id} className="flex flex-col items-center gap-1" style={{ width: 96 }}>
                        <div className="text-2xl">{MEDAL[place]}</div>
                        <div className="font-black text-gray-900 text-sm text-center leading-tight">{ps.player.name}</div>
                        <div className="text-xs text-gray-400">{ps.wins}W · {Math.round(ps.winRate * 100)}%</div>
                        <div
                          className="w-full rounded-t-xl flex items-center justify-center"
                          style={{
                            height: PODIUM_HEIGHT[place],
                            backgroundColor: PODIUM_COLOR[place],
                            printColorAdjust: 'exact',
                          }}
                        >
                          <span className="text-white font-black text-2xl opacity-70">{place}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Player leaderboard ── */}
              {playerStats.length > 0 && (
                <div>
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">👥 Player Leaderboard</h2>
                  <div className="flex flex-col gap-2">
                    {playerStats.map((ps, idx) => {
                      const barColor =
                        ps.winRate >= 0.6 ? '#22c55e' : ps.winRate >= 0.4 ? '#eab308' : '#ef4444';
                      const bg =
                        idx === 0 ? '#fefce8' : idx === 1 ? '#f9fafb' : idx === 2 ? '#fff7ed' : '#f9fafb';
                      const rankBg =
                        idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#fb923c' : '#e5e7eb';
                      const rankColor = idx < 3 ? '#fff' : '#6b7280';

                      return (
                        <div
                          key={ps.player.id}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ backgroundColor: bg, printColorAdjust: 'exact' }}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                            style={{ backgroundColor: rankBg, color: rankColor, printColorAdjust: 'exact' }}
                          >
                            {idx + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-black text-gray-900 text-sm">{ps.player.name}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.round(ps.winRate * 100)}%`,
                                    backgroundColor: barColor,
                                    printColorAdjust: 'exact',
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">
                                {Math.round(ps.winRate * 100)}%
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="font-black text-gray-900 text-sm">
                              {ps.wins}W{' '}
                              <span className="font-normal text-gray-400 text-xs">/ {ps.gamesPlayed}G</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Team standings ── */}
              {teamStats.length > 0 && (
                <div>
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">🏀 Team Standings</h2>
                  <div className="rounded-2xl overflow-hidden border border-gray-100">
                    {/* Table header */}
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
                          style={{
                            backgroundColor: idx === 0 ? '#fff7ed' : 'white',
                            printColorAdjust: 'exact',
                          }}
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
                      const dur = calcDuration(match);

                      return (
                        <div
                          key={match.id}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                          style={{ backgroundColor: '#f9fafb', printColorAdjust: 'exact' }}
                        >
                          <span className="text-xs font-bold text-gray-400 w-10 flex-shrink-0">#{match.round}</span>

                          <div className="flex-1 flex items-center gap-2">
                            <span
                              className="flex-1 text-right text-sm font-black"
                              style={{ color: aWon ? '#16a34a' : '#9ca3af' }}
                            >
                              {tA?.name ?? '—'}
                            </span>

                            <div
                              className="flex items-center gap-1 px-3 py-1 rounded-xl flex-shrink-0"
                              style={{ backgroundColor: '#1f2937', printColorAdjust: 'exact' }}
                            >
                              <span
                                className="text-base font-black"
                                style={{ color: aWon ? '#4ade80' : 'white' }}
                              >
                                {match.score.teamA}
                              </span>
                              <span className="text-gray-500 text-xs mx-0.5">:</span>
                              <span
                                className="text-base font-black"
                                style={{ color: bWon ? '#4ade80' : 'white' }}
                              >
                                {match.score.teamB}
                              </span>
                            </div>

                            <span
                              className="flex-1 text-sm font-black"
                              style={{ color: bWon ? '#16a34a' : '#9ca3af' }}
                            >
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

              {/* ── Footer ── */}
              <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-100">
                <span className="text-2xl">🏀</span>
                <div className="text-center">
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">HoopUp</div>
                  <div className="text-xs text-gray-300">Generated {new Date().toLocaleDateString()}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Floating action buttons */}
      <div className="no-print fixed bottom-6 left-0 right-0 z-[70] flex justify-center gap-3 px-4">
        <button
          onClick={() => window.print()}
          className="bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-black px-7 py-4 rounded-2xl shadow-2xl shadow-orange-500/40 text-base transition-colors"
        >
          📄 Export PDF
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
