import { Link } from 'react-router-dom'

import { computeStandings } from '../domain/engine'
import type { Tournament } from '../domain/types'
import { useTournamentStore } from '../state/TournamentStore'

export function DashboardPage() {
  const { tournaments } = useTournamentStore()
  const activeTournament = tournaments
    .filter((t) => t.status === 'active')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const pastTournaments = tournaments.filter((t) => t.status === 'completed')

  if (tournaments.length === 0) return <EmptyState />

  return (
    <div className="flex h-full flex-col">
      {activeTournament && <HeroCard tournament={activeTournament} />}
      {pastTournaments.length > 0 && (
        <section className="mt-3">
          <p className="label mb-2">Past</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pastTournaments.map((t) => (
              <PastChip key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-5xl mb-4">🎾</div>
      <h1 className="display-xl text-4xl">Let's Play</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)] max-w-xs">
        Create your first tournament
      </p>
      <Link className="btn-primary mt-6" to="/new">New Tournament</Link>
    </div>
  )
}

function HeroCard({ tournament }: { tournament: Tournament }) {
  const standings = computeStandings(tournament)
  const top3 = standings.slice(0, 3)
  const totalRounds = tournament.rounds.length

  return (
    <Link
      className="group relative flex-1 flex flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-1)] border border-white/6 transition-all active:scale-[0.995]"
      to={`/tournament/${tournament.id}`}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--electric)]/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative flex-1 flex flex-col p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 rounded-full bg-[var(--electric)]" />
          <span className="label">Round {totalRounds} · {tournament.mode}</span>
        </div>
        <h1 className="display-xl text-3xl sm:text-4xl">{tournament.name}</h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {tournament.players.length} players · {tournament.courts} courts
        </p>

        {/* Mini standings as horizontal bars */}
        {top3.length > 0 && (
          <div className="mt-auto pt-4 grid gap-1.5">
            {top3.map((s, i) => (
              <div key={s.playerId} className="flex items-center gap-2">
                <span className="w-5 text-sm text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <span className="text-xs font-medium w-16 truncate">{s.name}</span>
                <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${top3[0].totalPoints > 0 ? (s.totalPoints / top3[0].totalPoints) * 100 : 0}%`,
                      background: i === 0 ? 'var(--electric)' : 'var(--surface-3)',
                    }}
                  />
                </div>
                <span className="score-num text-xs text-[var(--text-muted)] w-8 text-right">{s.totalPoints}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/4 px-5 py-2.5">
        <span className="text-xs text-[var(--text-muted)]">Tap to continue</span>
        <span className="display text-xs text-[var(--electric)]">Continue →</span>
      </div>
    </Link>
  )
}

function PastChip({ tournament }: { tournament: Tournament }) {
  const standings = computeStandings(tournament)
  const winner = standings[0]

  return (
    <Link
      className="flex-shrink-0 rounded-[var(--radius-md)] bg-[var(--surface-1)] border border-white/4 px-3 py-2 transition-all active:scale-[0.97]"
      to={`/tournament/${tournament.id}`}
    >
      <p className="display text-xs">{tournament.name}</p>
      <p className="text-[0.65rem] text-[var(--text-muted)] mt-0.5">
        🏆 {winner?.name ?? '–'} · {tournament.rounds.length}R
      </p>
    </Link>
  )
}
