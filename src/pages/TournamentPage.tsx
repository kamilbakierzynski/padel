import { useRef, useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ScoreSlider } from '../components/ScoreSlider'
import { getRoundLabel, isRoundComplete } from '../domain/engine'
import type { Match, Round, Tournament } from '../domain/types'
import { useTournamentStore } from '../state/TournamentStore'

const ROUND_SOURCE_LABELS: Record<Round['source'], string> = {
  deterministic: 'Seeded',
  randomized: 'Random draw',
  standings: 'Standings',
  seeded: 'Fixed seed',
  'court-locked': 'Court locked',
  'promotion-relegation': 'Promo/Relegate',
}

export function TournamentPage() {
  const { tournamentId } = useParams()
  const { tournaments, finishTournament, generateNextRound, reopenTournament, saveMatchScore } = useTournamentStore()
  const [scoringMatch, setScoringMatch] = useState<{ round: Round; match: Match } | null>(null)
  const [endConfirmOpen, setEndConfirmOpen] = useState(false)
  const tournament = tournaments.find((t) => t.id === tournamentId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [tournament?.rounds.length])

  useEffect(() => {
    if (!endConfirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEndConfirmOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [endConfirmOpen])

  if (!tournament) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="display-xl text-2xl">Not Found</h1>
        <Link className="btn-primary mt-4" to="/">Home</Link>
      </div>
    )
  }

  const handleSaveScore = (round: Round, match: Match, scoreA: number) => {
    saveMatchScore({ tournamentId: tournament.id, roundId: round.id, matchId: match.id, scoreA })
  }

  const handleNextRound = () => {
    generateNextRound(tournament.id)
    setTimeout(() => {
      scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' })
    }, 50)
  }

  const currentRound = tournament.rounds.at(-1)
  const roundComplete = currentRound ? isRoundComplete(currentRound) : false

  return (
    <div className="flex h-full flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${
            tournament.status === 'active' ? 'bg-[var(--electric)]' : 'bg-[var(--text-muted)]'
          }`} />
          <h1 className="display text-xl truncate">{tournament.name}</h1>
          <span className="label flex-shrink-0">{tournament.mode}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span className="rounded-[var(--radius-sm)] bg-[var(--surface-1)] px-2 py-1">{tournament.players.length}p</span>
          <span className="rounded-[var(--radius-sm)] bg-[var(--surface-1)] px-2 py-1">{tournament.courts}c</span>
        </div>
      </div>

      {/* Round pills */}
      <div className="flex items-center gap-1.5 pb-2">
        {tournament.rounds.map((round, i) => (
          <button
            key={round.id}
            className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${
              i === tournament.rounds.length - 1
                ? 'bg-[var(--electric)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
            onClick={() => document.getElementById(`r-${round.id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })}
            type="button"
          >
            R{round.number}
          </button>
        ))}
        {tournament.status === 'completed' && (
          <span className="display text-xs text-[var(--gold)] ml-auto">🏆 Complete</span>
        )}
      </div>

      {/* Rounds scroll area — fills remaining height */}
      <div
        ref={scrollRef}
        className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth"
      >
        {tournament.rounds.map((round) => (
          <RoundView
            key={round.id}
            round={round}
            tournament={tournament}
            onOpenScoring={(match) => setScoringMatch({ round, match })}
          />
        ))}
      </div>

      {/* Action bar */}
      {tournament.status === 'active' && (
        <div className="flex items-center gap-2 pt-2">
          {roundComplete && (
            <button className="btn-primary flex-1" onClick={handleNextRound} type="button">
              ⚡ Round {tournament.rounds.length + 1}
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => setEndConfirmOpen(true)}
            type="button"
          >
            🏁 End
          </button>
        </div>
      )}
      {tournament.status === 'completed' && (
        <div className="flex items-center gap-2 pt-2">
          <button
            className="btn-primary flex-1"
            onClick={() => reopenTournament(tournament.id)}
            type="button"
          >
            ↩ Reopen tournament
          </button>
        </div>
      )}

      {endConfirmOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]"
            onClick={() => setEndConfirmOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-tournament-title"
            aria-describedby="end-tournament-desc"
          >
            <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-[var(--surface-1)] p-5 shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/[0.06]">
              <h2 id="end-tournament-title" className="display text-lg text-white">
                End tournament?
              </h2>
              <p id="end-tournament-desc" className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
                This marks <span className="text-[var(--text-primary)] font-medium">{tournament.name}</span> as complete. The Summary tab will list final standings, every round, and head-to-head records.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setEndConfirmOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={() => {
                    finishTournament(tournament.id)
                    setEndConfirmOpen(false)
                  }}
                  type="button"
                >
                  End tournament
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Score slider overlay */}
      {scoringMatch && (
        <ScoreSlider
          initialScoreA={scoringMatch.match.scoreA}
          onClose={() => setScoringMatch(null)}
          onSave={(scoreA) => handleSaveScore(scoringMatch.round, scoringMatch.match, scoreA)}
          teamA={scoringMatch.match.teamAPlayerIds.map((id) => getName(tournament, id)) as [string, string]}
          teamB={scoringMatch.match.teamBPlayerIds.map((id) => getName(tournament, id)) as [string, string]}
          hint={
            tournament.mode === 'mexicano' && scoringMatch.round.number < tournament.rounds.length
              ? 'Editing recalculates later rounds'
              : undefined
          }
        />
      )}
    </div>
  )
}

function RoundView({ round, tournament, onOpenScoring }: {
  round: Round
  tournament: Tournament
  onOpenScoring: (match: Match) => void
}) {
  const complete = isRoundComplete(round)

  return (
    <div id={`r-${round.id}`} className="w-full flex-shrink-0 snap-center flex flex-col" style={{ minWidth: 'min(100%, 640px)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="display text-lg">{getRoundLabel(round)}</h2>
          <span className="label">{ROUND_SOURCE_LABELS[round.source] ?? round.source}</span>
        </div>
        {complete && <span className="label text-[var(--court-teal)]">✓ Done</span>}
      </div>

      {round.byePlayerIds.length > 0 && (
        <div className="mb-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--surface-3)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
          Bye: {round.byePlayerIds.map((id) => getName(tournament, id)).join(', ')}
        </div>
      )}

      <div className="flex-1 grid gap-3 content-start" style={{
        gridTemplateColumns: round.matches.length > 1 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
      }}>
        {round.matches.map((match) => (
          <CourtCard key={match.id} match={match} tournament={tournament} onTap={() => onOpenScoring(match)} />
        ))}
      </div>
    </div>
  )
}

function CourtCard({ match, tournament, onTap }: { match: Match; tournament: Tournament; onTap: () => void }) {
  const scored = match.scoreA !== null
  const teamA = match.teamAPlayerIds.map((id) => getName(tournament, id))
  const teamB = match.teamBPlayerIds.map((id) => getName(tournament, id))

  return (
    <button
      className={`court flex w-full text-left transition-all active:scale-[0.98] ${
        !scored ? 'pulse-border' : ''
      }`}
      onClick={onTap}
      type="button"
      style={{ minHeight: '140px' }}
    >
      {/* Court label */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-white/40">
          {match.court}
        </span>
      </div>

      {/* Team A side (left) */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 px-3 py-4">
        <p className="display text-sm text-white/90 leading-tight">{teamA[0]}</p>
        <p className="display text-sm text-white/90 leading-tight">{teamA[1]}</p>
        {scored && (
          <span className={`score-num text-5xl mt-1 ${match.scoreA! > match.scoreB! ? 'text-[var(--gold)]' : 'text-white/30'}`}>
            {match.scoreA}
          </span>
        )}
      </div>

      {/* Net line is the .court::before vertical pseudo */}

      {/* Team B side (right) */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 px-3 py-4">
        <p className="display text-sm text-white/90 leading-tight">{teamB[0]}</p>
        <p className="display text-sm text-white/90 leading-tight">{teamB[1]}</p>
        {scored && (
          <span className={`score-num text-5xl mt-1 ${match.scoreB! > match.scoreA! ? 'text-[var(--gold)]' : 'text-white/30'}`}>
            {match.scoreB}
          </span>
        )}
      </div>

      {/* Tap prompt for unscored */}
      {!scored && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <span className="rounded-[var(--radius-pill)] bg-black/40 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white/80">
            Tap to score
          </span>
        </div>
      )}
    </button>
  )
}

function getName(tournament: Tournament, playerId: string) {
  return tournament.players.find((p) => p.id === playerId)?.name ?? '?'
}
