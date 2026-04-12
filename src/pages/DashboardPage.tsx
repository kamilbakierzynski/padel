import { Link } from 'react-router-dom'

import { getLeaderLabel } from '../domain/engine'
import { useTournamentStore } from '../state/TournamentStore'

export function DashboardPage() {
  const { tournaments } = useTournamentStore()

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(255,183,3,0.35),_transparent_65%)] lg:block" />
        <div className="relative max-w-2xl">
          <p className="eyebrow">Club control room</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.92] text-[var(--ink)] sm:text-6xl">
            Run bright, touch-first padel nights on one iPad.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--muted)]">
            Americano stays fair and deterministic. Mexicano reshuffles from live standings. Every tournament
            lives locally, resumes instantly, and works without a backend.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="primary-action" to="/new">
              Create tournament
            </Link>
            <a className="secondary-action" href="#active-tournaments">
              Jump to active boards
            </a>
          </div>
        </div>
        <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
          <MetricCard label="Saved boards" value={String(tournaments.length)} />
          <MetricCard
            label="Active now"
            value={String(tournaments.filter((tournament) => tournament.status === 'active').length)}
          />
          <MetricCard
            label="Modes"
            value={tournaments.some((tournament) => tournament.mode === 'mexicano') ? '2 live' : 'Americano'}
          />
        </div>
      </section>
      <section className="panel bg-[linear-gradient(180deg,rgba(15,139,141,0.9),rgba(7,42,45,0.96))] text-white">
        <p className="eyebrow text-white/65">Why this build</p>
        <h2 className="mt-3 font-display text-4xl leading-none">Local-first by design.</h2>
        <ul className="mt-6 grid gap-3 text-sm text-white/80">
          <li className="rounded-[1.4rem] border border-white/15 bg-white/10 p-4">
            Route-based UI for dashboard, creation, and live boards.
          </li>
          <li className="rounded-[1.4rem] border border-white/15 bg-white/10 p-4">
            Pure tournament engine keeps Americano and Mexicano rules out of the view layer.
          </li>
          <li className="rounded-[1.4rem] border border-white/15 bg-white/10 p-4">
            Local storage persistence and PWA support make Safari resume fast on iPad.
          </li>
        </ul>
      </section>
      <section className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Saved tournaments</p>
            <h2 className="mt-2 text-3xl font-display text-[var(--ink)]" id="active-tournaments">
              Organizer boards
            </h2>
          </div>
        </div>
        {tournaments.length === 0 ? (
          <div className="panel grid place-items-center text-center">
            <div className="max-w-md">
              <p className="eyebrow">Fresh court</p>
              <h3 className="mt-3 text-3xl font-display text-[var(--ink)]">No tournaments saved yet.</h3>
              <p className="mt-3 text-[var(--muted)]">
                Create the first board to generate round one immediately and keep running scores locally.
              </p>
              <Link className="primary-action mt-6 inline-flex" to="/new">
                Start a new board
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {tournaments.map((tournament) => (
              <Link className="tournament-card" key={tournament.id} to={`/tournament/${tournament.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">{tournament.mode}</p>
                    <h3 className="mt-2 text-2xl font-display text-[var(--ink)]">{tournament.name}</h3>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                      tournament.status === 'active'
                        ? 'bg-[var(--lime)]/35 text-[var(--ink)]'
                        : 'bg-[var(--surface-strong)] text-[var(--muted)]'
                    }`}
                  >
                    {tournament.status}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <StatPill label="Players" value={String(tournament.players.length)} />
                  <StatPill label="Courts" value={String(tournament.courts)} />
                  <StatPill label="Rounds" value={String(tournament.rounds.length)} />
                </div>
                <div className="mt-5 rounded-[1.4rem] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                  Leader: <span className="font-semibold text-[var(--ink)]">{getLeaderLabel(tournament)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.6rem] border border-white/80 bg-white/75 p-4 shadow-[0_14px_30px_rgba(7,42,45,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-3xl font-black text-[var(--ink)]">{value}</p>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] bg-white/75 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-xl font-black text-[var(--ink)]">{value}</p>
    </div>
  )
}
