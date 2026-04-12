import { Link, useParams } from 'react-router-dom'

import { computeStandings } from '../domain/engine'
import type { Standing } from '../domain/types'
import { useTournamentStore } from '../state/TournamentStore'

export function StandingsPage() {
  const { tournamentId } = useParams()
  const { tournaments } = useTournamentStore()
  const tournament = tournaments.find((t) => t.id === tournamentId)

  if (!tournament) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <h1 className="display-xl text-2xl">Not Found</h1>
        <Link className="btn-primary mt-4" to="/">Home</Link>
      </div>
    )
  }

  const standings = computeStandings(tournament)
  const top3 = standings.slice(0, 3)
  const rest = standings.slice(3)
  const isComplete = tournament.status === 'completed'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-2">
        <h1 className="display text-xl">Standings</h1>
        <span className="label">{tournament.name}</span>
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-2 px-4 pb-3" style={{ minHeight: '160px' }}>
          {top3[1] && <Pillar s={top3[1]} rank={2} h="90px" delay="100ms" champ={isComplete} />}
          {top3[0] && <Pillar s={top3[0]} rank={1} h="120px" delay="0ms" champ={isComplete} />}
          {top3[2] && <Pillar s={top3[2]} rank={3} h="72px" delay="200ms" champ={isComplete} />}
        </div>
      )}

      {/* Ranked list */}
      <div className="flex-1 overflow-y-auto grid gap-1 content-start">
        {rest.map((s) => (
          <div
            key={s.playerId}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] px-3 py-2"
          >
            <span className="score-num w-5 text-center text-sm text-[var(--text-muted)]">{s.rank}</span>
            <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
            <span className="label">{s.wins}W {s.losses}L</span>
            <span className="score-num text-base">{s.totalPoints}</span>
            <DiffBadge value={s.differential} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Pillar({ s, rank, h, delay, champ }: { s: Standing; rank: number; h: string; delay: string; champ: boolean }) {
  const isFirst = rank === 1
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'

  const bg = isFirst
    ? 'bg-gradient-to-t from-[var(--electric)]/15 to-[var(--gold)]/15 border-[var(--gold)]/25'
    : 'bg-[var(--surface-1)] border-white/6'

  return (
    <div className="flex-1 max-w-[180px] grow-up" style={{ animationDelay: delay }}>
      <div
        className={`flex flex-col items-center justify-end rounded-t-[var(--radius-md)] border border-b-0 ${bg} p-3 relative`}
        style={{ height: h }}
      >
        {isFirst && <div className="absolute inset-0 shimmer pointer-events-none" />}
        <div className="relative text-center">
          {isFirst && champ && <p className="display text-[0.55rem] text-[var(--gold)] mb-0.5">Champion</p>}
          <p className="text-xl leading-none">{medal}</p>
          <p className="display text-sm mt-1 leading-tight">{s.name}</p>
          <p className="score-num text-lg mt-0.5">{s.totalPoints}</p>
          <p className="text-[0.6rem] text-[var(--text-muted)] mt-0.5">{s.wins}W {s.losses}L</p>
          <DiffBadge value={s.differential} />
        </div>
      </div>
      <div className={`h-1 rounded-b-[var(--radius-md)] ${isFirst ? 'bg-[var(--gold)]' : rank === 2 ? 'bg-[var(--text-muted)]/40' : 'bg-[var(--text-muted)]/25'}`} />
    </div>
  )
}

function DiffBadge({ value }: { value: number }) {
  if (value === 0) return null
  return (
    <span className={`inline-block rounded-[var(--radius-pill)] px-1.5 py-px text-[0.6rem] font-bold ${
      value > 0 ? 'bg-[var(--court-teal)]/12 text-[var(--court-teal)]' : 'bg-[var(--rally-red)]/12 text-[var(--rally-red)]'
    }`}>
      {value > 0 ? '+' : ''}{value}
    </span>
  )
}
