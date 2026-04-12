import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ScoreStepper } from '../components/ScoreStepper'
import { computeStandings, getRoundLabel, isRoundComplete } from '../domain/engine'
import type { Match, Round, Tournament } from '../domain/types'
import { useTournamentStore } from '../state/TournamentStore'

export function TournamentPage() {
  const { tournamentId } = useParams()
  const { tournaments, finishTournament, generateNextRound, saveMatchScore } = useTournamentStore()
  const [notice, setNotice] = useState<string | null>(null)
  const tournament = tournaments.find((entry) => entry.id === tournamentId)

  if (!tournament) {
    return (
      <div className="panel">
        <p className="eyebrow">Missing board</p>
        <h1 className="mt-3 text-4xl font-display text-[var(--ink)]">Tournament not found.</h1>
        <p className="mt-3 text-[var(--muted)]">The board may have been removed from local storage on this device.</p>
        <Link className="primary-action mt-6 inline-flex" to="/">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const standings = computeStandings(tournament)
  const currentRound = tournament.rounds.at(-1)
  const historicalRounds = currentRound ? tournament.rounds.slice(0, -1) : tournament.rounds

  const handleSaveScore = (round: Round, match: Match, scoreA: number) => {
    const result = saveMatchScore({
      tournamentId: tournament.id,
      roundId: round.id,
      matchId: match.id,
      scoreA,
    })

    if (result.droppedFutureRounds > 0) {
      setNotice(
        `Mexicano edit applied. ${result.droppedFutureRounds} later round${result.droppedFutureRounds === 1 ? '' : 's'} were removed so regrouping can continue from the corrected standings.`,
      )
      return
    }

    setNotice('Result saved locally.')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <section className="grid gap-6">
        <TournamentHero tournament={tournament} />
        {notice ? (
          <div className="rounded-[1.4rem] border border-[var(--court)]/20 bg-[var(--court)]/10 px-4 py-3 text-sm text-[var(--ink)]">
            {notice}
          </div>
        ) : null}
        {currentRound ? (
          <div className="panel">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">{currentRound.source}</p>
                <h2 className="mt-2 text-3xl font-display text-[var(--ink)]">{getRoundLabel(currentRound)}</h2>
                <p className="mt-2 max-w-2xl text-[var(--muted)]">
                  {tournament.mode === 'americano'
                    ? 'Americano keeps partners rotating while minimizing repeated opponents.'
                    : 'Mexicano groups players by live standings, then schedules each court as 1+4 vs 2+3.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {tournament.status === 'active' && isRoundComplete(currentRound) ? (
                  <button
                    className="primary-action"
                    onClick={() => {
                      generateNextRound(tournament.id)
                      setNotice('Next round generated from the latest standings.')
                    }}
                    type="button"
                  >
                    Generate next round
                  </button>
                ) : null}
                {tournament.status === 'active' ? (
                  <button
                    className="secondary-action"
                    onClick={() => {
                      finishTournament(tournament.id)
                      setNotice('Tournament marked complete. Final standings are frozen locally.')
                    }}
                    type="button"
                  >
                    Finish tournament
                  </button>
                ) : null}
              </div>
            </div>
            {currentRound.byePlayerIds.length > 0 ? (
              <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                Bye rotation this round:{' '}
                <span className="font-semibold text-[var(--ink)]">
                  {currentRound.byePlayerIds.map((playerId) => getPlayerName(tournament, playerId)).join(', ')}
                </span>
              </div>
            ) : null}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {currentRound.matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onSave={(score) => handleSaveScore(currentRound, match, score)}
                  tournament={tournament}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Recent history</p>
              <h2 className="mt-2 text-3xl font-display text-[var(--ink)]">Editable results</h2>
            </div>
          </div>
          {historicalRounds.length === 0 ? (
            <p className="mt-6 text-[var(--muted)]">No completed history yet. Save scores in the current round to build standings.</p>
          ) : (
            <div className="mt-6 grid gap-4">
              {historicalRounds
                .slice()
                .reverse()
                .map((round) => (
                  <div className="rounded-[1.8rem] border border-white/75 bg-white/85 p-4" key={round.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="eyebrow">{round.source}</p>
                        <h3 className="mt-2 text-2xl font-display text-[var(--ink)]">{getRoundLabel(round)}</h3>
                      </div>
                      {tournament.mode === 'mexicano' ? (
                        <div className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                          Editing here trims later rounds
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {round.matches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          onSave={(score) => handleSaveScore(round, match, score)}
                          tournament={tournament}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
      <aside className="grid gap-6">
        <div className="panel bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(244,238,216,0.92))]">
          <p className="eyebrow">Standings</p>
          <h2 className="mt-2 text-3xl font-display text-[var(--ink)]">Live table</h2>
          <div className="mt-6 space-y-3">
            {standings.map((standing, index) => (
              <div
                className={`rounded-[1.5rem] px-4 py-4 ${
                  index === 0
                    ? 'bg-[linear-gradient(135deg,var(--sun),var(--accent))] text-[var(--ink)] shadow-[0_16px_30px_rgba(255,183,3,0.28)]'
                    : 'bg-white/85 text-[var(--ink)]'
                }`}
                key={standing.playerId}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-black/10 text-sm font-black">
                      {standing.rank}
                    </div>
                    <div>
                      <div className="font-bold">{standing.name}</div>
                      <div className="text-sm opacity-70">
                        {standing.played} matches · {standing.byes} byes
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black">{standing.totalPoints}</div>
                    <div className="text-sm opacity-70">
                      diff {standing.differential >= 0 ? '+' : ''}
                      {standing.differential}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

function TournamentHero({ tournament }: { tournament: Tournament }) {
  return (
    <div className="panel overflow-hidden bg-[linear-gradient(135deg,rgba(15,139,141,0.12),rgba(255,183,3,0.22))]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{tournament.mode} tournament</p>
          <h1 className="mt-3 text-4xl font-display text-[var(--ink)] sm:text-5xl">{tournament.name}</h1>
          <p className="mt-3 text-[var(--muted)]">
            {tournament.players.length} players, {tournament.courts} courts, all scores stored on this device.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SummaryChip label="Status" value={tournament.status} />
          <SummaryChip label="Rounds" value={String(tournament.rounds.length)} />
          <SummaryChip label="Format" value={tournament.mode} />
        </div>
      </div>
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/75 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-lg font-black text-[var(--ink)]">{value}</p>
    </div>
  )
}

function MatchCard({
  match,
  onSave,
  tournament,
}: {
  match: Match
  onSave: (scoreA: number) => void
  tournament: Tournament
}) {
  const teamALabel = match.teamAPlayerIds.map((playerId) => getPlayerName(tournament, playerId)).join(' + ')
  const teamBLabel = match.teamBPlayerIds.map((playerId) => getPlayerName(tournament, playerId)).join(' + ')

  return (
    <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,244,237,0.95))] p-4 shadow-[0_18px_30px_rgba(7,42,45,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Court {match.court}</p>
          <h3 className="mt-2 text-2xl font-display text-[var(--ink)]">{teamALabel}</h3>
          <p className="text-[var(--muted)]">vs {teamBLabel}</p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
            match.scoreA === null ? 'bg-[var(--surface-strong)] text-[var(--muted)]' : 'bg-[var(--lime)]/35 text-[var(--ink)]'
          }`}
        >
          {match.scoreA === null ? 'Pending' : 'Saved'}
        </div>
      </div>
      <ScoreStepper
        hint="Only one score is editable. The opposing team is auto-filled to keep totals at 21."
        initialScoreA={match.scoreA}
        key={`${match.id}-${match.scoreA ?? 'pending'}`}
        onSave={onSave}
        teamALabel={teamALabel}
        teamBLabel={teamBLabel}
      />
    </div>
  )
}

function getPlayerName(tournament: Tournament, playerId: string) {
  return tournament.players.find((player) => player.id === playerId)?.name ?? 'Unknown'
}
