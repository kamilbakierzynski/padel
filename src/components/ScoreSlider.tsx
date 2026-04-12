import { useCallback, useEffect, useRef, useState } from 'react'

import { POINTS_PER_MATCH } from '../domain/engine'

interface ScoreSliderProps {
  teamA: [string, string]
  teamB: [string, string]
  initialScoreA: number | null
  onSave: (scoreA: number) => void
  onClose: () => void
  hint?: string
}

const QUICK: Array<[number, number]> = [[21, 0], [15, 6], [12, 9], [11, 10]]

export function ScoreSlider({ teamA, teamB, initialScoreA, onSave, onClose, hint }: ScoreSliderProps) {
  const [scoreA, setScoreA] = useState(() => initialScoreA ?? 11)
  const scoreB = POINTS_PER_MATCH - scoreA
  const hasChanged = initialScoreA !== scoreA
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const positionToScore = useCallback((clientX: number) => {
    const t = trackRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    setScoreA(Math.round(ratio * POINTS_PER_MATCH))
  }, [])

  const onDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    positionToScore(e.clientX)
  }, [positionToScore])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    positionToScore(e.clientX)
  }, [positionToScore])

  const onUp = useCallback(() => { dragging.current = false }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const pctA = (scoreA / POINTS_PER_MATCH) * 100

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 slide-up">
        <div className="mx-auto max-w-xl rounded-t-xl bg-[var(--surface-1)] px-5 pb-[calc(var(--tab-height)+env(safe-area-inset-bottom,0px)+0.5rem)] pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">
          <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-white/15" />

          {/* Team names + scores row */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
            <div className="text-left">
              <p className="display text-sm text-[var(--electric)]">{teamA[0]}</p>
              <p className="display text-sm text-[var(--electric)]">{teamA[1]}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`score-num text-4xl ${scoreA > scoreB ? 'text-[var(--electric)]' : 'text-[var(--text-muted)]'}`}>
                {scoreA}
              </span>
              <span className="text-[var(--text-muted)] text-sm">—</span>
              <span className={`score-num text-4xl ${scoreB > scoreA ? 'text-[var(--court-teal)]' : 'text-[var(--text-muted)]'}`}>
                {scoreB}
              </span>
            </div>
            <div className="text-right">
              <p className="display text-sm text-[var(--court-teal)]">{teamB[0]}</p>
              <p className="display text-sm text-[var(--court-teal)]">{teamB[1]}</p>
            </div>
          </div>

          {/* Slider track */}
          <div
            ref={trackRef}
            className="relative h-12 cursor-pointer rounded-full bg-[var(--surface-0)] overflow-hidden touch-none select-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {/* Team A fill */}
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${pctA}%`, background: 'linear-gradient(90deg, var(--electric), var(--ember))' }}
            />
            {/* Team B fill */}
            <div
              className="absolute inset-y-0 right-0"
              style={{ width: `${100 - pctA}%`, background: 'linear-gradient(270deg, var(--court-teal), #1a9a7a)' }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
              style={{ left: `${pctA}%` }}
            >
              <div className="flex h-full items-center justify-center gap-px">
                <div className="h-3.5 w-px rounded-full bg-[var(--surface-3)]" />
                <div className="h-3.5 w-px rounded-full bg-[var(--surface-3)]" />
                <div className="h-3.5 w-px rounded-full bg-[var(--surface-3)]" />
              </div>
            </div>
          </div>

          {/* Quick picks */}
          <div className="mt-3 flex justify-center gap-1.5">
            {QUICK.map(([a, b]) => (
              <button
                key={a}
                className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-bold transition-colors active:scale-95 ${
                  scoreA === a ? 'bg-[var(--electric)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
                onClick={() => setScoreA(a)}
                type="button"
              >
                {a}–{b}
              </button>
            ))}
          </div>

          {hint && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">{hint}</p>}

          <button
            className="btn-primary mt-3 w-full"
            disabled={!hasChanged}
            onClick={() => { onSave(scoreA); onClose() }}
            type="button"
          >
            {initialScoreA === null ? 'Save' : 'Update'}
          </button>
        </div>
      </div>
    </>
  )
}
