'use client';

import { Session, Match, PlayerStats } from '@/lib/types';
import { getPositionColor } from '@/lib/matching';

interface Props {
  session: Session;
}

function formatDuration(match: Match): string {
  if (!match.endedAt || !match.startedAt) {
    const secs = match.elapsedSeconds;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
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
  const loser = match.winnerId ? session.teams.find((t) => t.id !== match.winnerId && [match.teamAId, match.teamBId].includes(t.id)) : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Match #{match.round}</span>
        <span className="text-xs text-gray-500">{match.endedAt ? new Date(match.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In progress'}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex-1 text-center p-3 rounded-xl ${match.winnerId === teamA?.id ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-700/50'}`}>
          <div className={`font-black text-lg ${match.winnerId === teamA?.id ? 'text-green-400' : 'text-gray-400'}`}>
            {teamA?.name ?? '—'}
          </div>
          <div className="text-3xl font-black text-white mt-1">{match.score.teamA}</div>
          {match.winnerId === teamA?.id && <div className="text-green-400 text-xs font-bold mt-1">🏆 WIN</div>}
        </div>

        <div className="text-gray-500 font-bold text-sm">VS</div>

        <div className={`flex-1 text-center p-3 rounded-xl ${match.winnerId === teamB?.id ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-700/50'}`}>
          <div className={`font-black text-lg ${match.winnerId === teamB?.id ? 'text-green-400' : 'text-gray-400'}`}>
            {teamB?.name ?? '—'}
          </div>
          <div className="text-3xl font-black text-white mt-1">{match.score.teamB}</div>
          {match.winnerId === teamB?.id && <div className="text-green-400 text-xs font-bold mt-1">🏆 WIN</div>}
        </div>
      </div>

      {winner && loser && (
        <div className="flex flex-wrap gap-2 mt-3">
          {winner.playerIds.map((pid) => {
            const p = session.players.find((pl) => pl.id === pid);
            if (!p) return null;
            return (
              <div key={pid} className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1">
                <span className="text-green-400 text-xs font-bold">{p.name}</span>
                {p.positions.slice(0, 1).map((pos) => (
                  <span key={pos} className={`${getPositionColor(pos)} text-white text-xs px-1 rounded`}>{pos}</span>
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
  const matches = session.completedMatches;

  // Player leaderboard
  const playerStats: PlayerStats[] = session.players
    .map((player) => ({
      player,
      wins: player.stats.wins,
      gamesPlayed: player.stats.gamesPlayed,
      winRate: player.stats.gamesPlayed > 0 ? player.stats.wins / player.stats.gamesPlayed : 0,
    }))
    .filter((ps) => ps.gamesPlayed > 0)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  // Team leaderboard
  const teamStats = [...session.teams]
    .filter((t) => t.stats.gamesPlayed > 0)
    .sort((a, b) => b.stats.wins - a.stats.wins);

  // Session highlights
  const mostWinsTeam = teamStats[0];
  const longestStreak = session.teams.reduce(
    (best, t) => Math.max(best, t.stats.wins),
    0
  );
  const avgMatchDuration =
    matches.length > 0
      ? matches.reduce((sum, m) => {
          if (!m.endedAt || !m.startedAt) return sum + m.elapsedSeconds;
          return sum + (new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000 + m.elapsedSeconds;
        }, 0) / matches.length
      : 0;

  if (matches.length === 0 && session.players.every((p) => p.stats.gamesPlayed === 0)) {
    return (
      <div className="flex flex-col items-center py-12 text-gray-500">
        <div className="text-5xl mb-3">📊</div>
        <p className="text-lg font-medium text-center">No history yet</p>
        <p className="text-sm mt-1 text-center">Stats will appear here as matches are played</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Today's highlights */}
      {matches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">📅 Today&apos;s Highlights</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-orange-500">{matches.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Matches</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-blue-400">{session.players.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Players</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-green-400">
                {Math.floor(avgMatchDuration / 60)}m
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Avg Match</div>
            </div>
          </div>
          {mostWinsTeam && (
            <div className="mt-2 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">
              <span className="text-orange-400 font-bold">
                🏆 Most wins today: {mostWinsTeam.name} ({mostWinsTeam.stats.wins}W)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Player leaderboard */}
      {playerStats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">👥 Player Leaderboard</h3>
          <div className="flex flex-col gap-2">
            {playerStats.map((ps, idx) => (
              <div key={ps.player.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                  idx === 0 ? 'bg-yellow-500 text-black' :
                  idx === 1 ? 'bg-gray-400 text-black' :
                  idx === 2 ? 'bg-orange-700 text-white' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{ps.player.name}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {ps.player.positions.map((pos) => (
                      <span key={pos} className={`${getPositionColor(pos)} text-white text-xs font-bold px-1.5 py-0.5 rounded`}>
                        {pos}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-white">
                    {ps.wins}W <span className="text-gray-500 font-normal">/ {ps.gamesPlayed}G</span>
                  </div>
                  <div className={`text-sm font-bold ${ps.winRate >= 0.6 ? 'text-green-400' : ps.winRate >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {Math.round(ps.winRate * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team leaderboard */}
      {teamStats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">🏀 Team Standings</h3>
          <div className="flex flex-col gap-2">
            {teamStats.map((team, idx) => (
              <div key={team.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                  idx === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">{team.name}</div>
                  <div className="text-xs text-gray-400">{team.stats.gamesPlayed} games played</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-white">
                    {team.stats.wins}W–{team.stats.losses}L
                  </div>
                  <div className={`text-sm font-bold ${
                    team.stats.gamesPlayed > 0 && team.stats.wins / team.stats.gamesPlayed >= 0.6
                      ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {team.stats.gamesPlayed > 0
                      ? Math.round((team.stats.wins / team.stats.gamesPlayed) * 100) + '%'
                      : '—'}
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
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            📋 Match History ({matches.length})
          </h3>
          <div className="flex flex-col gap-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
