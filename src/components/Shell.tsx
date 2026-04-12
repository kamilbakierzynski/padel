import type { PropsWithChildren } from 'react'
import { NavLink, useMatch } from 'react-router-dom'

import { useTournamentStore } from '../state/TournamentStore'

export function Shell({ children }: PropsWithChildren) {
  const exactMatch = useMatch('/tournament/:tournamentId')
  const subMatch = useMatch('/tournament/:tournamentId/*')
  const isTournament = exactMatch || subMatch

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--surface-0)] text-[var(--text-primary)]">
      <main className="flex-1 overflow-hidden px-4 pb-[var(--tab-height)] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5">
        {children}
      </main>
      <nav className="tab-bar">
        {isTournament ? (
          <TournamentTabs tournamentId={isTournament.params.tournamentId!} />
        ) : (
          <DefaultTabs />
        )}
      </nav>
    </div>
  )
}

function DefaultTabs() {
  return (
    <>
      <TabLink to="/" icon="🏠" label="Home" />
      <TabLink to="/new" icon="➕" label="New" />
    </>
  )
}

function TournamentTabs({ tournamentId }: { tournamentId: string }) {
  const { tournaments } = useTournamentStore()
  const tournament = tournaments.find((t) => t.id === tournamentId)
  const showSummary = tournament?.status === 'completed'

  return (
    <>
      <TabLink to="/" icon="🏠" label="Home" />
      <TabLink to={`/tournament/${tournamentId}`} icon="🎾" label="Rounds" end />
      <TabLink to={`/tournament/${tournamentId}/standings`} icon="🏆" label="Table" />
      {showSummary && (
        <TabLink to={`/tournament/${tournamentId}/summary`} icon="📋" label="Summary" />
      )}
    </>
  )
}

function TabLink({ to, icon, label, end }: { to: string; icon: string; label: string; end?: boolean }) {
  return (
    <NavLink
      className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
      to={to}
      end={end}
    >
      <span className="tab-icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}
