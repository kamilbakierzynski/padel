import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useTournamentStore } from '../state/TournamentStore'
import type { MexicanoVariant } from '../domain/types'

const BASE_STEPS = 4

export function CreateTournamentPage() {
  const navigate = useNavigate()
  const { createTournament } = useTournamentStore()
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<'americano' | 'mexicano'>('americano')
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const [courts, setCourts] = useState(1)
  const [mexicanoVariant, setMexicanoVariant] = useState<MexicanoVariant>('global-standings')
  const [minRoundsBeforeReseeding, setMinRoundsBeforeReseeding] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const totalSteps = mode === 'mexicano' ? BASE_STEPS + 1 : BASE_STEPS
  const maxCourts = Math.max(1, Math.floor(players.length / 4))

  useEffect(() => {
    if (courts > maxCourts) setCourts(Math.max(1, maxCourts))
  }, [players.length, maxCourts, courts])

  const canAdvance = () => {
    switch (step) {
      case 1: return true
      case 2: return name.trim().length > 0
      case 3: return players.length >= 4
      case 4: return courts >= 1 && courts <= maxCourts
      case 5: return true
      default: return false
    }
  }

  const handleNext = () => {
    setError(null)
    if (step < totalSteps) { setStep(step + 1); return }
    handleSubmit()
  }

  const handleBack = () => { setError(null); if (step > 1) setStep(step - 1) }

  const handleSubmit = () => {
    const unique = [...new Set(players)]
    if (unique.length < 4) { setError('Add at least 4 players.'); return }
    const effMax = Math.max(1, Math.floor(unique.length / 4))
    if (courts > effMax) { setError(`Max ${effMax} courts for ${unique.length} players.`); return }

    const tournament = createTournament({
      name: name.trim() || `${mode === 'americano' ? 'Americano' : 'Mexicano'} Night`,
      mode,
      courts,
      playerNames: unique,
      mexicanoVariant,
      minRoundsBeforeReseeding,
    })
    navigate(`/tournament/${tournament.id}`)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-1.5 py-3">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            className={`h-1 rounded-full transition-all duration-300 ${
              i + 1 === step ? 'w-6 bg-[var(--electric)]'
              : i + 1 < step ? 'w-1.5 bg-[var(--electric)]/40'
              : 'w-1.5 bg-[var(--surface-3)]'
            }`}
            key={i}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {step === 1 && <StepMode mode={mode} onSelect={setMode} />}
        {step === 2 && <StepName name={name} onChange={setName} />}
        {step === 3 && <StepPlayers players={players} onChange={setPlayers} />}
        {step === 4 && <StepCourts courts={courts} maxCourts={maxCourts} onChange={setCourts} playerCount={players.length} />}
        {step === 5 && mode === 'mexicano' && (
          <StepMexicanoOptions
            variant={mexicanoVariant}
            onVariantChange={setMexicanoVariant}
            minRoundsBeforeReseeding={minRoundsBeforeReseeding}
            onMinRoundsChange={setMinRoundsBeforeReseeding}
          />
        )}
      </div>

      {error && (
        <div className="mx-auto max-w-lg mb-2 rounded-[var(--radius-md)] border border-[var(--rally-red)]/20 bg-[var(--rally-red)]/8 px-3 py-2 text-xs text-[var(--rally-red)]">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        {step > 1 ? (
          <button className="btn-secondary" onClick={handleBack} type="button">← Back</button>
        ) : <div />}
        <button className="btn-primary" disabled={!canAdvance()} onClick={handleNext} type="button">
          {step === totalSteps ? '🎾 Start' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

function StepMode({ mode, onSelect }: { mode: 'americano' | 'mexicano'; onSelect: (m: 'americano' | 'mexicano') => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="display text-2xl text-[var(--text-muted)]">Choose Mode</h1>
      <div className="grid w-full max-w-lg grid-cols-2 gap-3">
        {(['americano', 'mexicano'] as const).map((m) => (
          <button
            key={m}
            className={`relative rounded-[var(--radius-lg)] border-2 p-5 text-left transition-all active:scale-[0.98] ${
              mode === m
                ? 'border-[var(--electric)] bg-[var(--electric)]/6'
                : 'border-[var(--surface-3)] bg-[var(--surface-1)]'
            }`}
            onClick={() => onSelect(m)}
            type="button"
          >
            <span className="text-2xl">{m === 'americano' ? '🔄' : '🌮'}</span>
            <h3 className="display mt-2 text-lg">{m}</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
              {m === 'americano'
                ? 'Fixed rotation — everyone plays with everyone'
                : 'Standings-based — teams remix each round'}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepName({ name, onChange }: { name: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="display text-2xl text-[var(--text-muted)]">Tournament Name</h1>
      <input
        autoFocus
        className="w-full max-w-sm border-b-2 border-[var(--surface-3)] bg-transparent text-center text-2xl font-semibold text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--electric)] placeholder:text-[var(--text-muted)]/30"
        onChange={(e) => onChange(e.target.value)}
        placeholder="Sunday Smash"
        value={name}
      />
    </div>
  )
}

function StepPlayers({ players, onChange }: { players: string[]; onChange: (p: string[]) => void }) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addPlayer = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    if (players.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...players, trimmed])
    setInput('')
    inputRef.current?.focus()
  }

  const removePlayer = (index: number) => {
    onChange(players.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="display text-2xl text-[var(--text-muted)]">Players</h1>
        <span className={`label px-2 py-0.5 rounded-[var(--radius-pill)] ${
          players.length >= 4
            ? 'bg-[var(--court-teal)]/12 text-[var(--court-teal)]'
            : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
        }`}>
          {players.length} added
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          autoFocus
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--surface-3)] bg-[var(--surface-1)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--electric)] placeholder:text-[var(--text-muted)]/40"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Player name..."
          value={input}
        />
        <button
          className="btn-primary px-4 py-2.5"
          disabled={!input.trim()}
          onClick={addPlayer}
          type="button"
        >
          Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-2 content-start">
          {players.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="group inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium"
            >
              {p}
              <button
                className="ml-0.5 h-4 w-4 rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--rally-red)] flex items-center justify-center text-xs leading-none"
                onClick={() => removePlayer(i)}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
          {players.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]/50 py-4">
              Type a name and press Enter or tap Add
            </p>
          )}
        </div>
      </div>

      {players.length > 0 && players.length < 4 && (
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Need {4 - players.length} more player{4 - players.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

function StepCourts({ courts, maxCourts, onChange, playerCount }: { courts: number; maxCourts: number; onChange: (v: number) => void; playerCount: number }) {
  const options = Array.from({ length: Math.max(maxCourts, 4) }, (_, i) => i + 1)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="display text-2xl text-[var(--text-muted)]">Courts</h1>
      <div className="flex gap-3">
        {options.map((n) => {
          const disabled = n > maxCourts
          return (
            <button
              key={n}
              className={`h-16 w-16 rounded-[var(--radius-md)] text-xl font-black transition-all active:scale-95 ${
                courts === n
                  ? 'bg-[var(--electric)] text-white shadow-[0_0_20px_rgba(255,107,26,0.25)]'
                  : disabled
                  ? 'bg-[var(--surface-2)] text-[var(--text-muted)]/20 cursor-not-allowed'
                  : 'bg-[var(--surface-1)] text-[var(--text-primary)] border border-[var(--surface-3)]'
              }`}
              disabled={disabled}
              onClick={() => onChange(n)}
              type="button"
            >
              {n}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        {courts} court{courts !== 1 ? 's' : ''} · {playerCount} players · {playerCount - courts * 4 > 0 ? `${playerCount - courts * 4} bye` : 'no byes'}
      </p>
    </div>
  )
}

const MEXICANO_VARIANTS: { value: MexicanoVariant; label: string; emoji: string; description: string }[] = [
  {
    value: 'global-standings',
    label: 'Global standings',
    emoji: '📊',
    description: 'Players re-ranked globally each round. Best court is always the top 4 in the leaderboard.',
  },
  {
    value: 'promotion-relegation',
    label: 'Promo / Relegation',
    emoji: '⬆️',
    description: 'Only the border players between adjacent courts swap each round. Advancement feels earned.',
  },
  {
    value: 'court-locked',
    label: 'Court locked',
    emoji: '🔒',
    description: 'Players stay on their starting court. Only pairings within the court change each round.',
  },
]

function StepMexicanoOptions({
  variant,
  onVariantChange,
  minRoundsBeforeReseeding,
  onMinRoundsChange,
}: {
  variant: MexicanoVariant
  onVariantChange: (v: MexicanoVariant) => void
  minRoundsBeforeReseeding: number
  onMinRoundsChange: (v: number) => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 gap-6 py-2">
      <div>
        <h1 className="display text-2xl text-[var(--text-muted)] mb-3">Pairing style</h1>
        <div className="grid gap-2">
          {MEXICANO_VARIANTS.map((opt) => (
            <button
              key={opt.value}
              className={`rounded-[var(--radius-lg)] border-2 p-4 text-left transition-all active:scale-[0.98] ${
                variant === opt.value
                  ? 'border-[var(--electric)] bg-[var(--electric)]/6'
                  : 'border-[var(--surface-3)] bg-[var(--surface-1)]'
              }`}
              onClick={() => onVariantChange(opt.value)}
              type="button"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{opt.emoji}</span>
                <span className="display text-sm">{opt.label}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {variant === 'global-standings' && (
        <div>
          <h2 className="display text-lg text-[var(--text-muted)] mb-1">Rounds before standings kick in</h2>
          <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">
            Keep players in their original seed order for this many rounds before switching to live standings. Useful when standings are volatile early on.
          </p>
          <div className="flex items-center gap-3">
            <button
              className="btn-secondary h-9 w-9 flex items-center justify-center text-lg"
              disabled={minRoundsBeforeReseeding <= 0}
              onClick={() => onMinRoundsChange(Math.max(0, minRoundsBeforeReseeding - 1))}
              type="button"
            >
              −
            </button>
            <span className="score-num text-2xl w-8 text-center">{minRoundsBeforeReseeding}</span>
            <button
              className="btn-secondary h-9 w-9 flex items-center justify-center text-lg"
              disabled={minRoundsBeforeReseeding >= 5}
              onClick={() => onMinRoundsChange(Math.min(5, minRoundsBeforeReseeding + 1))}
              type="button"
            >
              +
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              {minRoundsBeforeReseeding === 0
                ? 'Off — use standings from round 2'
                : `seed order for rounds 1–${minRoundsBeforeReseeding}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
