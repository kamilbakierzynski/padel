import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'

import {
  appendNextRound,
  createTournament as createTournamentRecord,
  finishTournament as finishTournamentRecord,
  reopenTournament as reopenTournamentRecord,
  updateMatchScore,
} from '../domain/engine'
import { createLocalTournamentRepository, subscribeToTournamentStorage } from '../domain/repository'
import type { Tournament, TournamentMode, MexicanoVariant } from '../domain/types'

interface CreateTournamentPayload {
  name: string
  mode: TournamentMode
  courts: number
  playerNames: string[]
  mexicanoVariant?: MexicanoVariant
  minRoundsBeforeReseeding?: number
}

interface TournamentStoreValue {
  tournaments: Tournament[]
  createTournament: (payload: CreateTournamentPayload) => Tournament
  saveMatchScore: (payload: {
    tournamentId: string
    roundId: string
    matchId: string
    scoreA: number
  }) => { droppedFutureRounds: number }
  generateNextRound: (tournamentId: string) => Tournament | undefined
  finishTournament: (tournamentId: string) => Tournament | undefined
  reopenTournament: (tournamentId: string) => Tournament | undefined
}

const TournamentStoreContext = createContext<TournamentStoreValue | null>(null)
const repository = createLocalTournamentRepository()

export function TournamentStoreProvider({ children }: PropsWithChildren) {
  const [tournaments, setTournaments] = useState<Tournament[]>(() => repository.list())

  useEffect(() => subscribeToTournamentStorage(() => setTournaments(repository.list())), [])

  const persist = (nextTournaments: Tournament[]) => {
    setTournaments(nextTournaments)
    repository.saveAll(nextTournaments)
  }

  const value: TournamentStoreValue = {
    tournaments,
    createTournament(payload) {
      const nextTournament = createTournamentRecord(payload)
      const nextTournaments = [nextTournament, ...tournaments]
      persist(nextTournaments)
      return nextTournament
    },
    saveMatchScore({ tournamentId, roundId, matchId, scoreA }) {
      const currentTournament = tournaments.find((tournament) => tournament.id === tournamentId)

      if (!currentTournament) {
        return { droppedFutureRounds: 0 }
      }

      const result = updateMatchScore(currentTournament, roundId, matchId, scoreA)
      persist(
        tournaments.map((tournament) => (tournament.id === tournamentId ? result.tournament : tournament)),
      )
      return { droppedFutureRounds: result.droppedFutureRounds }
    },
    generateNextRound(tournamentId) {
      const currentTournament = tournaments.find((tournament) => tournament.id === tournamentId)

      if (!currentTournament) {
        return undefined
      }

      const nextTournament = appendNextRound(currentTournament)
      persist(tournaments.map((tournament) => (tournament.id === tournamentId ? nextTournament : tournament)))
      return nextTournament
    },
    finishTournament(tournamentId) {
      const currentTournament = tournaments.find((tournament) => tournament.id === tournamentId)

      if (!currentTournament) {
        return undefined
      }

      const nextTournament = finishTournamentRecord(currentTournament)
      persist(tournaments.map((tournament) => (tournament.id === tournamentId ? nextTournament : tournament)))
      return nextTournament
    },
    reopenTournament(tournamentId) {
      const currentTournament = tournaments.find((tournament) => tournament.id === tournamentId)

      if (!currentTournament) {
        return undefined
      }

      const nextTournament = reopenTournamentRecord(currentTournament)
      persist(tournaments.map((tournament) => (tournament.id === tournamentId ? nextTournament : tournament)))
      return nextTournament
    },
  }

  return <TournamentStoreContext.Provider value={value}>{children}</TournamentStoreContext.Provider>
}

export function useTournamentStore() {
  const context = useContext(TournamentStoreContext)

  if (!context) {
    throw new Error('Tournament store is not available')
  }

  return context
}
