import { useState, type FormEvent, type PropsWithChildren } from 'react'
import { useNavigate } from 'react-router-dom'

import { useTournamentStore } from '../state/TournamentStore'

const SAMPLE_PLAYERS = ['Maya', 'Lena', 'Sofia', 'Ava', 'Zara', 'Nina', 'Ella', 'Mila']

export function CreateTournamentPage() {
  const navigate = useNavigate()
  const { createTournament } = useTournamentStore()
  const [name, setName] = useState('Saturday Club Ladder')
  const [mode, setMode] = useState<'americano' | 'mexicano'>('americano')
  const [playersText, setPlayersText] = useState(() => SAMPLE_PLAYERS.join('\n'))
  const [courts, setCourts] = useState(2)
  const [error, setError] = useState<string | null>(null)

  const playerNames = playersText
    .split(/\r?\n|,/)
    .map((playerName) => playerName.trim())
    .filter(Boolean)
  const recommendedCourts = Math.max(1, Math.floor(playerNames.length / 4))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const uniquePlayerNames = [...new Set(playerNames)]

    if (uniquePlayerNames.length < 4) {
      setError('Add at least four distinct players to start a tournament.')
      return
    }

    const maxCourts = Math.max(1, Math.floor(uniquePlayerNames.length / 4))

    if (courts < 1 || courts > maxCourts) {
      setError(`Choose between 1 and ${maxCourts} courts for ${uniquePlayerNames.length} players.`)
      return
    }

    const tournament = createTournament({
      name,
      mode,
      courts,
      playerNames: uniquePlayerNames,
    })

    navigate(`/tournament/${tournament.id}`)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="panel bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(252,237,192,0.92))]">
        <p className="eyebrow">Setup notes</p>
        <h1 className="mt-3 text-4xl font-display text-[var(--ink)]">Build a playable board in one pass.</h1>
        <div className="mt-6 grid gap-3">
          <Callout title="Americano">
            Deterministic opening round, strict partner rotation pressure, fair bye rotation, and rematch avoidance
            when possible.
          </Callout>
          <Callout title="Mexicano">
            Random opening round, then 1+4 vs 2+3 regrouping by live standings after every completed round.
          </Callout>
          <Callout title="Edits">
            Historical score edits recalculate standings. Mexicano trims future rounds so the next regroup reflects
            the corrected result.
          </Callout>
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">New tournament</p>
        <h2 className="mt-3 text-4xl font-display text-[var(--ink)]">Organizer setup</h2>
        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="form-label">Tournament name</span>
            <input
              className="text-input"
              onChange={(event) => setName(event.target.value)}
              placeholder="Monday Ladder"
              value={name}
            />
          </label>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <span className="form-label">Mode</span>
              <div className="mt-2 grid gap-3">
                <ModeCard
                  active={mode === 'americano'}
                  body="Stable partner rotation, deterministic opener, score-based standings."
                  onClick={() => setMode('americano')}
                  title="Americano"
                />
                <ModeCard
                  active={mode === 'mexicano'}
                  body="Random opener, standings regroup every round, edits rebuild the live path."
                  onClick={() => setMode('mexicano')}
                  title="Mexicano"
                />
              </div>
            </div>
            <label className="grid gap-2">
              <span className="form-label">Courts</span>
              <input
                className="text-input"
                max={Math.max(1, recommendedCourts)}
                min={1}
                onChange={(event) => setCourts(Number(event.target.value))}
                type="number"
                value={courts}
              />
              <p className="text-sm text-[var(--muted)]">
                Recommended for current roster: {recommendedCourts}. Extra players rotate through byes fairly.
              </p>
            </label>
          </div>
          <label className="grid gap-2">
            <span className="form-label">Players</span>
            <textarea
              className="text-area"
              onChange={(event) => setPlayersText(event.target.value)}
              rows={12}
              value={playersText}
            />
            <p className="text-sm text-[var(--muted)]">
              Enter one player per line. Current roster: {playerNames.length} names.
            </p>
          </label>
          {error ? (
            <div className="rounded-[1.2rem] border border-[var(--accent)]/25 bg-[var(--accent)]/12 px-4 py-3 text-sm text-[var(--ink)]">
              {error}
            </div>
          ) : null}
          <button className="primary-action w-full justify-center" type="submit">
            Create and open board
          </button>
        </form>
      </section>
    </div>
  )
}

function ModeCard({
  active,
  body,
  onClick,
  title,
}: {
  active: boolean
  body: string
  onClick: () => void
  title: string
}) {
  return (
    <button
      className={`rounded-[1.5rem] border p-4 text-left transition ${
        active
          ? 'border-[var(--court)] bg-[var(--court)]/12 shadow-[0_18px_30px_rgba(15,139,141,0.12)]'
          : 'border-white/70 bg-white/70 hover:border-[var(--sand-strong)]'
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[var(--ink)]">{title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
            active ? 'bg-[var(--court)] text-white' : 'bg-[var(--surface-strong)] text-[var(--muted)]'
          }`}
        >
          {active ? 'Selected' : 'Tap to use'}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
    </button>
  )
}

function Callout({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/72 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--ink)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{children}</p>
    </div>
  )
}
