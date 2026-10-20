import { describe, expect, it } from 'vitest'

import { packAmericanoGames } from './americano-packing'
import type { IndexedGame } from './americano-packing'
import { buildBalancedDesign } from './americano-designs'

function gamesFor(count: number): IndexedGame[] {
  const circle = Array.from({ length: count + count % 2 }, (_, index) => index < count ? index : -1)
  const games: IndexedGame[] = []
  for (let round = 0; round < circle.length - 1; round += 1) {
    const teams: [number, number][] = []
    for (let index = 0; index < circle.length / 2; index += 1) {
      const pair: [number, number] = [circle[index], circle[circle.length - 1 - index]]
      if (!pair.includes(-1)) teams.push(pair)
    }
    for (let index = 0; index < teams.length; index += 2) games.push([teams[index], teams[index + 1]])
    circle.splice(1, 0, circle.pop()!)
  }
  return games
}

function verify(result: IndexedGame[][] | null, games: IndexedGame[], courts: number): void {
  expect(result).not.toBeNull()
  expect(result!.flat().map((game) => JSON.stringify(game)).sort()).toEqual(games.map((game) => JSON.stringify(game)).sort())
  for (const round of result!) {
    expect(round).toHaveLength(courts)
    expect(new Set(round.flat(2)).size).toBe(courts * 4)
  }
}

describe('full-court Americano packing', () => {
  it.each([[9, 2, 1], [12, 2, 2], [16, 3, 1]])(
    'packs exact whist games for %i players and %i courts across deterministic seeds', (count, courts, cycles) => {
      const base = buildBalancedDesign(count)!.flat()
      const games = Array.from({ length: cycles }, (_, cycle) => base.map((game) => game.map((team) =>
        team.map((player) => (player + cycle) % count)) as IndexedGame)).flat()
      for (let seed = 0; seed < 6; seed += 1) {
        verify(packAmericanoGames(games, count, courts, Array(count).fill(0), Array(count).fill(0), seed), games, courts)
      }
    },
  )

  it.each([[8, 1, 1], [9, 2, 1], [12, 2, 2], [16, 3, 1], [33, 8, 1]])(
    'consumes every fixed game exactly once for %i players and %i courts', (count, courts, cycles) => {
      const games = Array.from({ length: cycles }, () => gamesFor(count)).flat()
      const result = packAmericanoGames(games, count, courts, Array(count).fill(0), Array(count).fill(0), 123)
      verify(result, games, courts)
    },
  )

  it('uses cumulative appearances to compensate an uneven inherited history', () => {
    const games = gamesFor(9)
    const appearances = [0, 1, 1, 1, 1, 1, 1, 1, 1]
    const lastPlayed = [...appearances]
    const result = packAmericanoGames(games, 9, 2, appearances, lastPlayed, 4, 1)!
    const firstActive = new Set(result[0].flat(2))
    expect(firstActive.has(0)).toBe(true)
    const counts = [...appearances]
    let previousBye = 0
    for (const round of result) {
      const active = new Set(round.flat(2))
      const bye = counts.findIndex((_, player) => !active.has(player))
      expect(bye).not.toBe(previousBye)
      previousBye = bye
      for (const player of active) counts[player] += 1
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })

  it('orders a one-court eight-player cycle with a count spread of at most one', () => {
    const games = gamesFor(8)
    const result = packAmericanoGames(games, 8, 1, Array(8).fill(0), Array(8).fill(0), 32)!
    const counts = Array<number>(8).fill(0)
    for (const round of result) {
      for (const player of round.flat(2)) counts[player] += 1
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })

  it('respects historical game preference after player fairness', () => {
    const games = gamesFor(4)
    const result = packAmericanoGames(games, 4, 1, [3, 3, 3, 3], [3, 3, 3, 3], 1, 3,
      [[2, 1, 0], [1, 3, 0], [1, 2, 0]])!
    expect(result[0][0]).toEqual(games[2])
  })

  it('is deterministic and leaves all inputs unchanged', () => {
    const games = gamesFor(12).concat(gamesFor(12))
    const appearances = Array<number>(12).fill(0)
    const lastPlayed = [...appearances]
    const before = JSON.stringify({ games, appearances, lastPlayed })
    const first = packAmericanoGames(games, 12, 2, appearances, lastPlayed, 91)
    expect(packAmericanoGames(games, 12, 2, appearances, lastPlayed, 91)).toEqual(first)
    expect(JSON.stringify({ games, appearances, lastPlayed })).toBe(before)
  })

  it('returns null instead of a partial round when a complete cover is impossible', () => {
    const overlapping: IndexedGame[] = [[[0, 1], [2, 3]], [[0, 4], [5, 6]]]
    expect(packAmericanoGames(overlapping, 8, 2, Array(8).fill(0), Array(8).fill(0), 0)).toBeNull()
    expect(packAmericanoGames(gamesFor(12), 12, 2, Array(12).fill(0), Array(12).fill(0), 0)).toBeNull()
  })

  it('accepts a large constructive cover without requiring a search over its games', () => {
    const base = gamesFor(32)
    const games: IndexedGame[] = []
    for (let start = 0; start < base.length; start += 8) {
      const factor = base.slice(start, start + 8)
      for (let omitted = 0; omitted < 8; omitted += 1) {
        games.push(...factor.filter((_, index) => index !== omitted))
      }
    }
    expect(games).toHaveLength(1736)
    verify(packAmericanoGames(games, 32, 7, Array(32).fill(0), Array(32).fill(0), 0), games, 7)
  })

  it('declines a large unpacked pool for the caller to construct a cover', () => {
    const games = Array.from({ length: 7 }, () => gamesFor(32)).flat()
    ;[games[1], games[8]] = [games[8], games[1]]
    expect(games).toHaveLength(1736)
    expect(packAmericanoGames(games, 32, 7, Array(32).fill(0), Array(32).fill(0), 0)).toBeNull()
  })

  it('orders large no-bye schedules directly by historical preference', () => {
    const games = Array.from({ length: 100 }, () => gamesFor(8)).flat()
    const preferences = games.map((_, index) => [games.length - index, 0, 0])
    const result = packAmericanoGames(games, 8, 2, Array(8).fill(0), Array(8).fill(0), 0, 0, preferences)
    verify(result, games, 2)
    expect(result![0]).toEqual(games.slice(-2))
  })
})
