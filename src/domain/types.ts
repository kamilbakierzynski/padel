import type { AmericanoRoundPlan } from './americano'

export type TournamentMode = 'americano' | 'mexicano'
export type TournamentStatus = 'active' | 'completed'

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
  source: 'deterministic' | 'randomized' | 'standings' | 'rotation'
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
  /** Future full rounds; a block can contain multiple internal rotations. */
  americanoRotation?: {
    version?: number
    startRound: number
    rounds: AmericanoRoundPlan[]
  }
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
