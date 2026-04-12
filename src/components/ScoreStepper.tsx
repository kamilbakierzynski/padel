import { useState } from 'react'

import { POINTS_PER_MATCH } from '../domain/engine'

interface ScoreStepperProps {
  initialScoreA: number | null
  teamALabel: string
  teamBLabel: string
  onSave: (scoreA: number) => void
  hint?: string
}

const QUICK_SCORES = [21, 15, 11, 6, 0]

export function ScoreStepper({
  initialScoreA,
  teamALabel,
  teamBLabel,
  onSave,
  hint,
}: ScoreStepperProps) {
  const [draftScoreA, setDraftScoreA] = useState(() => initialScoreA ?? 11)

  const scoreB = POINTS_PER_MATCH - draftScoreA
  const hasChanged = initialScoreA !== draftScoreA

  return (
    <div className="rounded-[1.8rem] border border-white/70 bg-white/90 p-4 shadow-[0_16px_30px_rgba(15,65,72,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Score Entry
          </p>
          <h3 className="mt-1 text-base font-semibold text-[var(--ink)]">{teamALabel}</h3>
          <p className="text-sm text-[var(--muted)]">vs {teamBLabel}</p>
        </div>
        <div className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
          {POINTS_PER_MATCH} rally points
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <button
          className="touch-button text-2xl"
          onClick={() => setDraftScoreA((score) => Math.max(0, score - 1))}
          type="button"
        >
          -
        </button>
        <div className="rounded-[1.6rem] bg-[linear-gradient(135deg,var(--ink),#164147)] px-4 py-4 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
          <div className="flex items-center justify-center gap-3 text-4xl font-black leading-none tracking-tight">
            <span>{draftScoreA}</span>
            <span className="text-white/45">:</span>
            <span>{scoreB}</span>
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.22em] text-white/65">
            {teamALabel} / {teamBLabel}
          </div>
        </div>
        <button
          className="touch-button text-2xl"
          onClick={() => setDraftScoreA((score) => Math.min(POINTS_PER_MATCH, score + 1))}
          type="button"
        >
          +
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_SCORES.map((score) => (
          <button
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
              draftScoreA === score
                ? 'bg-[var(--accent)] text-[var(--ink)]'
                : 'bg-[var(--surface-strong)] text-[var(--muted)] hover:bg-[var(--sand)]'
            }`}
            key={score}
            onClick={() => setDraftScoreA(score)}
            type="button"
          >
            {score}:{POINTS_PER_MATCH - score}
          </button>
        ))}
      </div>
      {hint ? <p className="mt-3 text-sm text-[var(--muted)]">{hint}</p> : null}
      <button
        className="mt-4 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,var(--accent),var(--sun))] px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-[var(--ink)] shadow-[0_14px_30px_rgba(249,115,22,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        disabled={!hasChanged}
        onClick={() => onSave(draftScoreA)}
        type="button"
      >
        {initialScoreA === null ? 'Save result' : 'Update result'}
      </button>
    </div>
  )
}
