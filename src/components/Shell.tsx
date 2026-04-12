import type { PropsWithChildren } from 'react'
import { Link, NavLink } from 'react-router-dom'

export function Shell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[var(--accent)]/25 blur-3xl" />
        <div className="absolute right-[-6rem] top-32 h-80 w-80 rounded-full bg-[var(--court)]/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-96 w-96 rounded-full bg-[var(--sky)]/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.55),_transparent_42%)]" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/60 px-5 py-4 shadow-[0_20px_60px_rgba(7,42,45,0.09)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link className="flex items-center gap-3 text-[var(--ink)] no-underline" to="/">
              <div className="grid h-13 w-13 place-items-center rounded-[1.3rem] bg-[linear-gradient(135deg,var(--court),var(--court-dark))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                <img alt="Padel Parade" className="h-full w-full" src="/padel-icon.svg" />
              </div>
              <div>
                <div className="font-display text-xl leading-none tracking-[0.08em] text-[var(--ink)] uppercase">
                  Padel Parade
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  Local-first tournament board for Americano and Mexicano clubs.
                </div>
              </div>
            </Link>
          </div>
          <nav className="flex items-center gap-2">
            <NavPill to="/">Dashboard</NavPill>
            <NavPill to="/new">Create</NavPill>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

function NavPill({ to, children }: PropsWithChildren<{ to: string }>) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          'rounded-full px-4 py-2 text-sm font-semibold transition',
          isActive
            ? 'bg-[var(--ink)] text-white shadow-[0_10px_20px_rgba(7,42,45,0.15)]'
            : 'bg-white/70 text-[var(--ink)] hover:bg-white',
        ].join(' ')
      }
      to={to}
    >
      {children}
    </NavLink>
  )
}
