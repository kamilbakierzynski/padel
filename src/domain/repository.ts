import type { Tournament } from './types'

const STORAGE_KEY = 'padel-parade/tournaments/v1'

export interface TournamentRepository {
  list(): Tournament[]
  saveAll(tournaments: Tournament[]): void
}

export function createLocalTournamentRepository(): TournamentRepository {
  return {
    list() {
      if (typeof window === 'undefined') {
        return []
      }

      const rawValue = window.localStorage.getItem(STORAGE_KEY)

      if (!rawValue) {
        return []
      }

      try {
        const parsed = JSON.parse(rawValue) as Tournament[]
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    },
    saveAll(tournaments) {
      if (typeof window === 'undefined') {
        return
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments))
    },
  }
}

export function subscribeToTournamentStorage(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener()
    }
  }

  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener('storage', handleStorage)
  }
}
