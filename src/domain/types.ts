export type TournamentMode = 'americano' | 'mexicano'
export type TournamentStatus = 'active' | 'completed'
export type MexicanoVariant = 'global-standings' | 'promotion-relegation' | 'court-locked'

export interface Player {
  id: string
  name: string
  seed: number
}

export interface Match {
  id: string
  court: number
  teamAPlayerIds: [string, string]
  teamBPlayerIds: [string, string]
  scoreA: number | null
  scoreB: number | null
  completedAt: string | null
}

export interface Round {
  id: string
  number: number
  byePlayerIds: string[]
  matches: Match[]
  createdAt: string
  source: 'deterministic' | 'randomized' | 'standings' | 'seeded' | 'court-locked' | 'promotion-relegation'
}

export interface Tournament {
  id: string
  name: string
  mode: TournamentMode
  courts: number
  players: Player[]
  rounds: Round[]
  status: TournamentStatus
  createdAt: string
  updatedAt: string
  seed: number
  /** Only relevant for mode === 'mexicano'. Defaults to 'global-standings'. */
  mexicanoVariant?: MexicanoVariant
  /** For global-standings variant: keep original seed order for this many rounds before using live standings. Defaults to 0. */
  minRoundsBeforeReseeding?: number
}

export interface Standing {
  rank: number
  playerId: string
  name: string
  played: number
  wins: number
  losses: number
  byes: number
  totalPoints: number
  pointsAgainst: number
  differential: number
}
