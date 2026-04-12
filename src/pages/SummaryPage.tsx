import { Link, Navigate, useParams } from 'react-router-dom'

import { computeHeadToHead, computeStandings, getRoundLabel, isRoundComplete } from '../domain/engine'
import type { Match, Round, Tournament } from '../domain/types'
import { useTournamentStore } from '../state/TournamentStore'

export function SummaryPage() {
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

  if (tournament.status !== 'completed') {
    return <Navigate replace to={`/tournament/${tournament.id}`} />
  }

  const standings = computeStandings(tournament)
  const h2h = computeHeadToHead(tournament)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="display text-xl">Summary</h1>
          <span className="label truncate max-w-[50%] text-right">{tournament.name}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)] leading-snug">
          Final standings, every round and result, plus direct opponent records between players.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2 space-y-8">
        <StandingsSection standings={standings} />
        <MatchHistorySection tournament={tournament} />
        <HeadToHeadSection h2h={h2h} />
      </div>
    </div>
  )
}

function StandingsSection({ standings }: { standings: ReturnType<typeof computeStandings> }) {
  return (
    <section>
      <h2 className="label mb-3">Standings</h2>
      <ol className="grid gap-1.5">
        {standings.map((s) => (
          <li
            key={s.playerId}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] px-3 py-2.5 border border-white/[0.04]"
          >
            <span className="score-num w-7 text-center text-sm text-[var(--gold)]">{s.rank}</span>
            <span className="flex-1 min-w-0 text-sm font-medium truncate">{s.name}</span>
            <span className="label text-[0.6rem]">{s.wins}W {s.losses}L</span>
            <span className="score-num text-base tabular-nums">{s.totalPoints}</span>
            <DiffChip value={s.differential} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function DiffChip({ value }: { value: number }) {
  if (value === 0) {
    return <span className="w-10 text-right text-[0.65rem] text-[var(--text-muted)] tabular-nums">±0</span>
  }
  return (
    <span
      className={`min-w-[2.5rem] text-right text-[0.65rem] font-bold tabular-nums ${
        value > 0 ? 'text-[var(--court-teal)]' : 'text-[var(--rally-red)]'
      }`}
    >
      {value > 0 ? '+' : ''}
      {value}
    </span>
  )
}

function MatchHistorySection({ tournament }: { tournament: Tournament }) {
  return (
    <section>
      <h2 className="label mb-3">Rounds & match history</h2>
      <div className="space-y-5">
        {tournament.rounds.map((round) => (
          <RoundHistoryBlock key={round.id} round={round} tournament={tournament} />
        ))}
      </div>
    </section>
  )
}

function RoundHistoryBlock({ round, tournament }: { round: Round; tournament: Tournament }) {
  const done = isRoundComplete(round)

  return (
    <div className="rounded-[var(--radius-md)] border border-white/[0.06] bg-[var(--surface-1)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.05] bg-[var(--surface-2)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="display text-sm truncate">{getRoundLabel(round)}</span>
          <span className="label flex-shrink-0">{round.source}</span>
        </div>
        {done ? (
          <span className="label text-[var(--court-teal)]">Complete</span>
        ) : (
          <span className="label text-[var(--text-muted)]">Incomplete</span>
        )}
      </div>
      {round.byePlayerIds.length > 0 && (
        <p className="px-3 py-2 text-xs text-[var(--text-muted)] border-b border-white/[0.04]">
          Bye: {round.byePlayerIds.map((id) => nameOf(tournament, id)).join(', ')}
        </p>
      )}
      <ul className="divide-y divide-white/[0.04]">
        {round.matches.map((match) => (
          <MatchHistoryRow key={match.id} match={match} tournament={tournament} />
        ))}
      </ul>
    </div>
  )
}

function MatchHistoryRow({ match, tournament }: { match: Match; tournament: Tournament }) {
  const a = match.teamAPlayerIds.map((id) => nameOf(tournament, id)).join(' · ')
  const b = match.teamBPlayerIds.map((id) => nameOf(tournament, id)).join(' · ')
  const scored = match.scoreA !== null && match.scoreB !== null

  return (
    <li className="px-3 py-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-white/35">
        <span>Court {match.court}</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2 text-sm">
        <span className="font-medium text-white/90 truncate sm:flex-1 sm:text-right">{a}</span>
        {scored ? (
          <span className="score-num text-lg text-[var(--gold)] tabular-nums sm:px-2 flex-shrink-0">
            {match.scoreA} — {match.scoreB}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)] sm:px-2">No score</span>
        )}
        <span className="font-medium text-white/90 truncate sm:flex-1">{b}</span>
      </div>
    </li>
  )
}

function HeadToHeadSection({ h2h }: { h2h: ReturnType<typeof computeHeadToHead> }) {
  const { players, wins } = h2h

  return (
    <section className="pb-4">
      <h2 className="label mb-2">Head to head</h2>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        Cell shows wins for the row player against the column player when they were on opposite teams (doubles).
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-white/[0.06] bg-[var(--surface-1)]">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-[var(--surface-2)] p-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wide border-b border-r border-white/[0.06] min-w-[5.5rem]">
                vs
              </th>
              {players.map((p) => (
                <th
                  key={p.id}
                  className="p-2 text-center font-bold text-[var(--text-muted)] uppercase tracking-wide border-b border-white/[0.04] max-w-[4.5rem]"
                  title={p.name}
                >
                  <span className="block truncate">{shortName(p.name)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((row, ri) => (
              <tr key={row.id}>
                <th
                  className="sticky left-0 z-10 bg-[var(--surface-2)] p-2 text-left font-semibold text-white/90 border-r border-b border-white/[0.06] whitespace-nowrap"
                  title={row.name}
                >
                  <span className="truncate max-w-[7rem] inline-block align-bottom">{row.name}</span>
                </th>
                {players.map((col, ci) => (
                  <td
                    key={col.id}
                    className={`p-2 text-center border-b border-white/[0.04] tabular-nums ${
                      ri === ci ? 'bg-white/[0.02] text-[var(--text-muted)]' : 'text-white/85'
                    }`}
                  >
                    {ri === ci ? '—' : formatH2hCell(wins[ri][ci], wins[ci][ri])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatH2hCell(winsRow: number, winsCol: number) {
  if (winsRow === 0 && winsCol === 0) {
    return <span className="text-[var(--text-muted)]">—</span>
  }
  return (
    <span>
      <span className={winsRow > winsCol ? 'text-[var(--gold)]' : ''}>{winsRow}</span>
      <span className="text-[var(--text-muted)] mx-0.5">:</span>
      <span className={winsCol > winsRow ? 'text-[var(--gold)]' : ''}>{winsCol}</span>
    </span>
  )
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 3)
  }
  return `${parts[0][0]}.${parts.at(-1)!.slice(0, 3)}`
}

function nameOf(tournament: Tournament, playerId: string) {
  return tournament.players.find((p) => p.id === playerId)?.name ?? '?'
}
