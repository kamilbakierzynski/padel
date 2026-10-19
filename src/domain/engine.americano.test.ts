import { describe, expect, it } from 'vitest'

import { appendNextRound, computeStandings, finishTournament, reopenTournament, updateMatchScore } from './engine'
import type { Match, Round, Tournament } from './types'

function tournament(playerCount = 8, courts = 2, seed = 12345): Tournament {
  return {
    id: 'test', name: 'Americano', mode: 'americano', courts, seed,
    status: 'active', createdAt: '2026-10-18', updatedAt: '2026-10-18', rounds: [],
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index + 1}`, name: `Player ${index + 1}`, seed: index + 1,
    })),
  }
}

function playRounds(input: Tournament, count: number) {
  let current = input
  for (let index = 0; index < count; index += 1) {
    current = appendNextRound(current)
    const round = current.rounds.at(-1)!
    for (const match of round.matches) {
      current = updateMatchScore(current, round.id, match.id, 13).tournament
    }
  }
  return current
}

function matchKey(match: Match) {
  return [match.teamAPlayerIds, match.teamBPlayerIds].map((team) => [...team].sort().join(',')).sort().join('|')
}

function partnerCounts(rounds: Round[]) {
  const counts = new Map<string, number>()
  for (const round of rounds) for (const match of round.matches) {
    for (const team of [match.teamAPlayerIds, match.teamBPlayerIds]) {
      const key = [...team].sort().join(',')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

function layout(round: Round) {
  return { matches: round.matches.map(matchKey), byes: round.byePlayerIds, source: round.source }
}

describe('Americano rotation integration', () => {
  it.each([1, 2026, 12345, 987654])('continues past round 7 with fresh matches and complete partnerships (seed %i)', (seed) => {
    const result = playRounds(tournament(8, 2, seed), 14)
    expect(result.status).toBe('active')
    expect(result.rounds).toHaveLength(14)
    expect(new Set(result.rounds.flatMap((round) => round.matches.map(matchKey))).size).toBe(28)
    for (const rounds of [result.rounds.slice(0, 7), result.rounds.slice(7)]) {
      const partners = partnerCounts(rounds)
      expect(partners.size).toBe(28)
      expect([...partners.values()].every((count) => count === 1)).toBe(true)
    }
    expect(computeStandings(result).every((standing) => standing.played === 14)).toBe(true)
    expect(computeStandings(result).reduce((sum, standing) => sum + standing.totalPoints, 0)).toBe(28 * 42)
  })

  it('rotates all eight players across one court', () => {
    const result = playRounds(tournament(8, 1), 28)
    for (const rounds of [result.rounds.slice(0, 14), result.rounds.slice(14)]) {
      const partners = partnerCounts(rounds)
      expect(partners.size).toBe(28)
      expect([...partners.values()].every((count) => count === 1)).toBe(true)
      expect(rounds.every((round) => round.matches.length === 1 && round.byePlayerIds.length === 4)).toBe(true)
    }
    expect(computeStandings(result).every((standing) => standing.played === 14 && standing.byes === 14)).toBe(true)
    expect(new Set(result.rounds.flatMap((round) => round.matches.map(matchKey))).size).toBe(28)
  })

  it('keeps the saved rotation and standings after a JSON storage round trip', () => {
    const original = playRounds(tournament(), 3)
    const restored = JSON.parse(JSON.stringify(original)) as Tournament
    expect(computeStandings(restored)).toEqual(computeStandings(original))
    expect(layout(appendNextRound(restored).rounds.at(-1)!)).toEqual(layout(appendNextRound(original).rounds.at(-1)!))
    expect(playRounds(restored, 11).rounds.map(layout)).toEqual(playRounds(original, 11).rounds.map(layout))
  })

  it('preserves the current controls: an unfinished round or ended tournament cannot advance', () => {
    const current = appendNextRound(tournament())
    expect(appendNextRound(current)).toBe(current)
    const finished = finishTournament(playRounds(tournament(), 7))
    expect(appendNextRound(finished)).toBe(finished)
    expect(appendNextRound(reopenTournament(finished)).rounds).toHaveLength(8)
  })

  it('does not change later Americano pairings when correcting a result', () => {
    const current = playRounds(tournament(), 4)
    const round = current.rounds[0]
    const correction = updateMatchScore(current, round.id, round.matches[0].id, 20)
    expect(correction.droppedFutureRounds).toBe(0)
    expect(correction.tournament.rounds.map(layout)).toEqual(current.rounds.map(layout))
    expect(correction.tournament.americanoRotation).toEqual(current.americanoRotation)
    expect(layout(appendNextRound(correction.tournament).rounds.at(-1)!)).toEqual(layout(appendNextRound(current).rounds.at(-1)!))
  })

  it('retains all results in an older save and plans the next complete rotation', () => {
    const legacy = playRounds(tournament(), 3)
    delete legacy.americanoRotation
    const previousRounds = JSON.parse(JSON.stringify(legacy.rounds)) as Round[]
    const continued = playRounds(legacy, 7)
    expect(continued.rounds.slice(0, 3)).toEqual(previousRounds)
    const partners = partnerCounts(continued.rounds.slice(3))
    expect(partners.size).toBe(28)
    expect([...partners.values()].every((count) => count === 1)).toBe(true)
  })

  it.each([6, 7, 10, 11])('keeps %i-player Americano available with valid matches and balanced byes', (count) => {
    const courts = Math.floor(count / 4)
    const result = playRounds(tournament(count, courts), count * 2)
    for (const round of result.rounds) {
      const active = round.matches.flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
      expect(new Set([...active, ...round.byePlayerIds]).size).toBe(count)
      expect(active.length + round.byePlayerIds.length).toBe(count)
      expect(round.matches).toHaveLength(courts)
    }
    const byes = computeStandings(result).map((standing) => standing.byes)
    expect(Math.max(...byes) - Math.min(...byes)).toBeLessThanOrEqual(1)
    expect(result.americanoRotation).toBeUndefined()
  })

  it('continues a four-player tournament when whole-match repeats become unavoidable', () => {
    const result = playRounds(tournament(4, 1), 9)
    expect(result.rounds).toHaveLength(9)
    expect(new Set(result.rounds.flatMap((round) => round.matches.map(matchKey))).size).toBe(3)
    expect([...partnerCounts(result.rounds).values()].every((count) => count === 3)).toBe(true)
    for (let index = 1; index < result.rounds.length; index += 1) {
      expect(matchKey(result.rounds[index].matches[0])).not.toBe(matchKey(result.rounds[index - 1].matches[0]))
    }
  })
})
