'use client';

import { useState } from 'react';
import { Session, Match } from '@/lib/types';
import { getPositionColor } from '@/lib/matching';
import ReportModal from '@/components/ReportModal';

interface Props { session: Session; }

function formatDuration(match: Match): string {
  if (!match.endedAt || !match.startedAt) {
    const m = Math.floor(match.elapsedSeconds / 60);
    const s = Math.floor(match.elapsedSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  const elapsed = (new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime()) / 1000 + match.elapsedSeconds;
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MatchCard({ match, session }: { match: Match; session: Session }) {
  const teamA = session.teams.find((t) => t.id === match.teamAId);
  const teamB = session.teams.find((t) => t.id === match.teamBId);
  const winner = match.winnerId ? session.teams.find((t) => t.id === match.winnerId) : null;
  const loser  = match.winnerId ? session.teams.find((t) => t.id !== match.winnerId && [match.teamAId, match.teamBId].includes(t.id)) : null;

  const aWon = match.winnerId === teamA?.id;
  const bWon = match.winnerId === teamB?.id;
  const isDraw = match.endedAt !== null && match.winnerId === null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3D4557' }}>Match #{match.round}</span>
        <span className="text-[10px]" style={{ color: '#3D4557' }}>
          {match.endedAt ? new Date(match.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In progress'}
        </span>
      </div>

      <div className="grid grid-cols-3 items-center p-4 gap-3">
        <div
          className="text-center p-3 rounded-xl"
          style={aWon ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' } : isDraw ? { background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' } : { background: 'var(--surface)' }}
        >
          <div className="font-display text-lg tracking-widest leading-none" style={{ color: aWon ? '#4ADE80' : isDraw ? '#FBBF24' : '#8892A4' }}>{teamA?.name ?? '—'}</div>
          <div className="font-display text-4xl text-white mt-2 tabular-nums">{match.score.teamA}</div>
          {aWon && <div className="text-[10px] font-bold mt-1.5 text-green-400">🏆 WIN</div>}
          {isDraw && <div className="text-[10px] font-bold mt-1.5 text-yellow-400">🤝 DRAW</div>}
        </div>

        <div className="text-center">
          <span className="text-xs font-black tracking-widest" style={{ color: '#3D4557' }}>VS</span>
        </div>

        <div
          className="text-center p-3 rounded-xl"
          style={bWon ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' } : isDraw ? { background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' } : { background: 'var(--surface)' }}
        >
          <div className="font-display text-lg tracking-widest leading-none" style={{ color: bWon ? '#4ADE80' : isDraw ? '#FBBF24' : '#8892A4' }}>{teamB?.name ?? '—'}</div>
          <div className="font-display text-4xl text-white mt-2 tabular-nums">{match.score.teamB}</div>
          {bWon && <div className="text-[10px] font-bold mt-1.5 text-green-400">🏆 WIN</div>}
          {isDraw && <div className="text-[10px] font-bold mt-1.5 text-yellow-400">🤝 DRAW</div>}
        </div>
      </div>

      {winner && loser && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {winner.playerIds.map((pid) => {
            const p = session.players.find((pl) => pl.id === pid);
            if (!p) return null;
            return (
              <div key={pid} className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span className="text-green-400 text-[11px] font-bold">{p.name}</span>
                {p.positions.map((pos) => (
                  <span key={pos} className={`${getPositionColor(pos)} text-white text-[9px] px-1 rounded`}>{pos}</span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HistoryTab({ session }: Props) {
  const [showReport, setShowReport] = useState(false);
  const matches = session.completedMatches;

  const teamStats = [...session.teams].filter((t) => t.stats.gamesPlayed > 0).sort((a, b) => b.stats.wins - a.stats.wins);
  const mostWinsTeam = teamStats[0];
  const avgMatchDuration = matches.length > 0
    ? matches.reduce((sum, m) => {
        if (!m.endedAt || !m.startedAt) return sum + m.elapsedSeconds;
        return sum + (new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000 + m.elapsedSeconds;
      }, 0) / matches.length
    : 0;

  if (matches.length === 0 && teamStats.length === 0) {
    return (
      <div className="flex flex-col items-center py-14" style={{ color: '#3D4557' }}>
        <div className="text-5xl mb-3">📊</div>
        <p className="text-base font-bold text-center">No history yet</p>
        <p className="text-sm mt-1 text-center">Stats will appear as matches are played</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {matches.length > 0 && (
        <button
          onClick={() => setShowReport(true)}
          className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl transition-all uppercase tracking-wide"
          style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C38)', boxShadow: '0 6px 20px rgba(255,107,0,0.3)' }}
        >
          🖼 Export Session Report
        </button>
      )}

      {showReport && <ReportModal session={session} onClose={() => setShowReport(false)} />}

      {/* Highlights */}
      {matches.length > 0 && (
        <div>
          <SectionLabel>Today&apos;s Highlights</SectionLabel>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { value: matches.length, label: 'Matches', color: 'var(--orange)' },
              { value: session.players.length, label: 'Players', color: '#60A5FA' },
              { value: `${Math.floor(avgMatchDuration / 60)}m`, label: 'Avg Match', color: '#4ADE80' },
            ].map(({ value, label, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
                <div className="font-display text-3xl leading-none" style={{ color }}>{value}</div>
                <div className="text-[10px] font-bold tracking-widest uppercase mt-1" style={{ color: '#3D4557' }}>{label}</div>
              </div>
            ))}
          </div>
          {mostWinsTeam && (
            <div className="mt-2 rounded-xl p-3 text-center" style={{ background: 'rgba(255,107,0,0.08)', border: '1.5px solid rgba(255,107,0,0.2)' }}>
              <span className="font-bold text-sm" style={{ color: 'var(--orange2)' }}>
                🏆 Most wins: {mostWinsTeam.name} ({mostWinsTeam.stats.wins}W)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Team standings */}
      {teamStats.length > 0 && (
        <div>
          <SectionLabel>Team Standings</SectionLabel>
          <div className="flex flex-col gap-2 mt-2">
            {teamStats.map((team, idx) => (
              <div key={team.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={idx === 0 ? { background: '#CA8A04', color: '#000' } : { background: 'var(--surface)', color: '#8892A4' }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-display text-lg tracking-widest text-white leading-none">{team.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#3D4557' }}>{team.stats.gamesPlayed} games played</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-white text-sm">{team.stats.wins}W–{team.stats.losses}L</div>
                  <div className="font-bold text-sm" style={{ color: team.stats.gamesPlayed > 0 && team.stats.wins / team.stats.gamesPlayed >= 0.6 ? '#4ADE80' : '#8892A4' }}>
                    {team.stats.gamesPlayed > 0 ? Math.round((team.stats.wins / team.stats.gamesPlayed) * 100) + '%' : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match history */}
      {matches.length > 0 && (
        <div>
          <SectionLabel count={matches.length}>Match History</SectionLabel>
          <div className="flex flex-col gap-2 mt-2">
            {matches.map((match) => <MatchCard key={match.id} match={match} session={session} />)}
          </div>
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
