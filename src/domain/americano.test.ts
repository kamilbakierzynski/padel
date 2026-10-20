import { describe, expect, it } from 'vitest'

import { buildAmericanoCycle, isFullAmericanoCyclePossible } from './americano'
import type { AmericanoMatchPlan, AmericanoRoundPlan } from './americano'
import type { Player, Round } from './types'

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({ id: `player-${index}`, name: `Player ${index}`, seed: index }))
}

function pairKey(team: string[]): string {
  return JSON.stringify([...team].sort())
}

function matchKey(match: AmericanoMatchPlan): string {
  return JSON.stringify([pairKey(match.teamAPlayerIds), pairKey(match.teamBPlayerIds)].sort())
}

function asHistory(cycle: AmericanoRoundPlan[], offset = 0): Round[] {
  return cycle.map((round, index) => ({
    ...round,
    id: `round-${offset + index}`,
    number: offset + index + 1,
    createdAt: '',
    source: 'deterministic',
    matches: round.matches.map((match, court) => ({
      ...match, id: `match-${offset + index}-${court}`, court: court + 1,
      scoreA: null, scoreB: null, completedAt: null,
    })),
  }))
}

function verifyCycle(cycle: AmericanoRoundPlan[], roster: Player[], courts: number, repetitions = 1): void {
  const partnerships = new Map<string, number>()
  const byes = new Map(roster.map((player) => [player.id, 0]))
  for (const round of cycle) {
    expect(round.matches.length).toBeGreaterThan(0)
    expect(round.matches.length).toBeLessThanOrEqual(courts)
    const active = round.matches.flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
    expect(new Set(active).size).toBe(active.length)
    expect([...active, ...round.byePlayerIds].sort()).toEqual(roster.map((player) => player.id).sort())
    for (const id of round.byePlayerIds) byes.set(id, byes.get(id)! + 1)
    for (const match of round.matches) for (const team of [match.teamAPlayerIds, match.teamBPlayerIds]) {
      const key = pairKey(team)
      partnerships.set(key, (partnerships.get(key) ?? 0) + 1)
    }
  }
  expect(partnerships.size).toBe(roster.length * (roster.length - 1) / 2)
  expect(new Set(partnerships.values())).toEqual(new Set([repetitions]))
  expect(new Set(byes.values()).size).toBe(1)
}

function opponentCounts(cycle: AmericanoRoundPlan[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const round of cycle) for (const match of round.matches) {
    for (const a of match.teamAPlayerIds) for (const b of match.teamBPlayerIds) {
      const key = pairKey([a, b])
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

describe('complete Americano cycles', () => {
  it.each([1, 2026, 12345])('finishes each 20-player rotation before repeating partnerships, seed %i', (seed) => {
    const roster = players(20)
    const plan = buildAmericanoCycle(roster, 4, [], seed)
    verifyCycle(plan, roster, 4, 4)
    expect(plan).toHaveLength(95)
    const counts = new Map<string, number>()
    for (const a of roster) for (const b of roster) if (a.id < b.id) counts.set(pairKey([a.id, b.id]), 0)
    for (const round of plan) {
      expect(round.matches).toHaveLength(4)
      for (const match of round.matches) for (const team of [match.teamAPlayerIds, match.teamBPlayerIds]) {
        const key = pairKey(team)
        counts.set(key, counts.get(key)! + 1)
      }
      expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1)
    }
    expect(new Set(opponentCounts(plan).values())).toEqual(new Set([8]))
    expect(new Set(plan.flatMap((round) => round.matches.map(matchKey))).size).toBe(380)
  })
  it.each([[12, 16], [13, 19]])('mixes %i-player rotations only in their boundary round', (count, fullRounds) => {
    const plan = buildAmericanoCycle(players(count), 2, [], 12345)
    const pairs = (rounds: AmericanoRoundPlan[]) => rounds.flatMap((round) => round.matches.flatMap((match) =>
      [pairKey(match.teamAPlayerIds), pairKey(match.teamBPlayerIds)]))
    const first = pairs(plan.slice(0, fullRounds))
    expect(new Set(first).size).toBe(first.length)
    expect(new Set(pairs(plan.slice(0, fullRounds + 1))).size).toBe(count * (count - 1) / 2)
    const last = pairs(plan.slice(fullRounds + 1))
    expect(new Set(last).size).toBe(last.length)
    expect(new Set(plan.flatMap((round) => round.matches.map(matchKey))).size).toBe(plan.length * 2)
  })
  it.each([4, 5, 8, 9, 12, 13, 16, 20, 33])('uses every partnership exactly once for %i players', (count) => {
    const roster = players(count)
    const courts = Math.floor(count / 4)
    const cycle = buildAmericanoCycle(roster, courts, [], 12345)
    verifyCycle(cycle, roster, courts)
    expect(cycle).toHaveLength(count % 2 === 0 ? count - 1 : count)
  })

  it.each([[8, 1, 14, 1], [9, 1, 18, 1], [12, 2, 33, 2], [13, 2, 39, 2], [16, 1, 60, 1], [16, 3, 20, 1]])(
    'fills courts with balanced complete blocks for %i players / %i courts', (count, courts, rounds, repetitions) => {
      const roster = players(count)
      const cycle = buildAmericanoCycle(roster, courts, [], 43)
      verifyCycle(cycle, roster, courts, repetitions)
      expect(cycle).toHaveLength(rounds)
      expect(cycle.every((round) => round.matches.length === courts)).toBe(true)
      expect(new Set(opponentCounts(cycle).values())).toEqual(new Set([2 * repetitions]))
      const appearances = new Map(roster.map((player) => [player.id, 0]))
      for (const round of cycle) {
        for (const match of round.matches) for (const id of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
          appearances.set(id, appearances.get(id)! + 1)
        }
        const counts = [...appearances.values()]
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
      }
      expect(new Set(appearances.values()).size).toBe(1)
    },
  )

  it.each([4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24, 25, 29])('balances every opponent twice for %i players', (count) => {
    const cycle = buildAmericanoCycle(players(count), Math.floor(count / 4), [], 12345)
    verifyCycle(cycle, players(count), Math.floor(count / 4))
    expect(opponentCounts(cycle).size).toBe(count * (count - 1) / 2)
    expect(new Set(opponentCounts(cycle).values())).toEqual(new Set([2]))
  })

  it.each([0, 1, 7, 42, 125, 4294967295])('balances eight-player opponents exactly for seed %i', (seed) => {
    const cycle = buildAmericanoCycle(players(8), 2, [], seed)
    expect(cycle).toHaveLength(7)
    expect(opponentCounts(cycle).size).toBe(28)
    expect(new Set(opponentCounts(cycle).values())).toEqual(new Set([2]))
  })

  it.each([4, 5, 8, 9, 12, 13, 16])('is deterministic and ignores player strength seeds for %i players', (count) => {
    const roster = players(count)
    const cycle = buildAmericanoCycle(roster, 2, [], 92)
    expect(buildAmericanoCycle(roster, 2, [], 92)).toEqual(cycle)
    expect(buildAmericanoCycle(roster.map((player) => ({ ...player, seed: 999 })), 2, [], 92)).toEqual(cycle)
  })

  it.each([0, 1, 2, 3, 4, 99, 829])('avoids entire previous-cycle matches for eight players, seed %i', (seed) => {
    const roster = players(8)
    const first = buildAmericanoCycle(roster, 2, [], seed)
    const firstKeys = new Set(first.flatMap((round) => round.matches.map(matchKey)))
    const second = buildAmericanoCycle(roster, 2, asHistory(first), seed + 1)
    verifyCycle(second, roster, 2)
    expect(second.flatMap((round) => round.matches).filter((match) => firstKeys.has(matchKey(match)))).toHaveLength(0)
    expect(new Set(opponentCounts(second).values())).toEqual(new Set([2]))
  })

  it('compares all earlier rounds and ignores side, partner and court ordering', () => {
    const roster = players(8)
    const history: Round[] = []
    for (let cycleIndex = 0; cycleIndex < 4; cycleIndex += 1) {
      const cycle = buildAmericanoCycle(roster, 2, history, cycleIndex + 20)
      verifyCycle(cycle, roster, 2)
      expect(new Set(opponentCounts(cycle).values())).toEqual(new Set([2]))
      const earlier = new Set(history.flatMap((round) => round.matches.map(matchKey)))
      expect(cycle.flatMap((round) => round.matches).filter((match) => earlier.has(matchKey(match)))).toHaveLength(0)
      const changed = cycle.map((round) => ({
        ...round,
        matches: [...round.matches].reverse().map((match) => ({
          teamAPlayerIds: [...match.teamBPlayerIds].reverse() as [string, string],
          teamBPlayerIds: [...match.teamAPlayerIds].reverse() as [string, string],
        })),
      }))
      history.push(...asHistory(changed, history.length))
    }
  })

  it('preserves partnerships under dense adversarial history and repeats the oldest four-player match first', () => {
    const roster = players(4)
    const initial = buildAmericanoCycle(roster, 1, [], 1)
    const history = asHistory([...initial, initial[0], initial[2]])
    const next = buildAmericanoCycle(roster, 1, history, 999)
    verifyCycle(next, roster, 1)
    expect(matchKey(next[0].matches[0])).toBe(matchKey(initial[1].matches[0]))
  })

  it('prefers the least frequently played match before recency when every four-player match must repeat', () => {
    const roster = players(4)
    const initial = buildAmericanoCycle(roster, 1, [], 1)
    const history = asHistory([initial[0], initial[0], initial[0], initial[1], initial[2]])
    const next = buildAmericanoCycle(roster, 1, history, 2)
    expect(matchKey(next[0].matches[0])).toBe(matchKey(initial[1].matches[0]))
  })

  it('avoids immediately repeating partnerships when starting another eight-player cycle', () => {
    const roster = players(8)
    const initial = buildAmericanoCycle(roster, 2, [], 12)
    const lastPartners = new Set(initial.at(-1)!.matches.flatMap((match) => [pairKey(match.teamAPlayerIds), pairKey(match.teamBPlayerIds)]))
    const next = buildAmericanoCycle(roster, 2, asHistory(initial), 13)
    expect(next[0].matches.flatMap((match) => [pairKey(match.teamAPlayerIds), pairKey(match.teamBPlayerIds)])
      .filter((key) => lastPartners.has(key))).toHaveLength(0)
  })

  it('still completes a valid cycle after all possible eight-player matches have already occurred', () => {
    const roster = players(8)
    const allGames: AmericanoRoundPlan[] = []
    for (let a = 0; a < 5; a += 1) for (let b = a + 1; b < 6; b += 1) {
      for (let c = b + 1; c < 7; c += 1) for (let d = c + 1; d < 8; d += 1) {
        for (const [first, second, third, fourth] of [[a, b, c, d], [a, c, b, d], [a, d, b, c]]) {
          allGames.push({
            matches: [{ teamAPlayerIds: [roster[first].id, roster[second].id], teamBPlayerIds: [roster[third].id, roster[fourth].id] }],
            byePlayerIds: [],
          })
        }
      }
    }
    expect(allGames).toHaveLength(210)
    const history = asHistory([...allGames, ...Array.from({ length: 20 }, () => allGames[0])])
    const next = buildAmericanoCycle(roster, 2, history, 17)
    verifyCycle(next, roster, 2)
    expect(next.flatMap((round) => round.matches).some((match) => matchKey(match) === matchKey(allGames[0].matches[0]))).toBe(false)
  })

  it('avoids an adversarially repeated full cycle even when it is absent from the most recent rounds', () => {
    const roster = players(8)
    const original = buildAmericanoCycle(roster, 2, [], 18)
    const recent = buildAmericanoCycle(roster, 2, asHistory(original), 19)
    const history = asHistory([...original, ...original, ...original, ...recent])
    const next = buildAmericanoCycle(roster, 2, history, 29)
    const earlier = new Set(history.flatMap((round) => round.matches.map(matchKey)))
    verifyCycle(next, roster, 2)
    expect(next.flatMap((round) => round.matches).filter((match) => earlier.has(matchKey(match)))).toHaveLength(0)
  })

  it('does not mutate players or history', () => {
    const roster = players(8)
    const history = asHistory(buildAmericanoCycle(roster, 2, [], 7))
    const original = JSON.stringify({ roster, history })
    buildAmericanoCycle(roster, 1, history, 8)
    expect(JSON.stringify({ roster, history })).toBe(original)
  })

  it.each([6, 7, 10, 11])('covers all partnerships with only one duplicate for %i players', (count) => {
    const cycle = buildAmericanoCycle(players(count), 1, [], 12345)
    const counts = new Map<string, number>()
    for (const round of cycle) for (const match of round.matches) {
      expect(new Set([...match.teamAPlayerIds, ...match.teamBPlayerIds]).size).toBe(4)
      for (const team of [match.teamAPlayerIds, match.teamBPlayerIds]) {
        const key = pairKey(team)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    expect(counts.size).toBe(count * (count - 1) / 2)
    expect([...counts.values()].filter((value) => value === 2)).toHaveLength(1)
    expect([...counts.values()].every((value) => value === 1 || value === 2)).toBe(true)
    expect(cycle).toHaveLength(Math.ceil(count * (count - 1) / 4))
  })

  it('keeps large incomplete fields playable when fixed-game packing is exhausted', () => {
    const roster = players(18)
    const plan = buildAmericanoCycle(roster, 4, [], 12345)
    const partners = new Set<string>()
    for (const round of plan) {
      expect(round.matches).toHaveLength(4)
      const active = round.matches.flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
      expect(new Set(active).size).toBe(16)
      expect(new Set([...active, ...round.byePlayerIds]).size).toBe(18)
      for (const match of round.matches) for (const team of [match.teamAPlayerIds, match.teamBPlayerIds]) partners.add(pairKey(team))
    }
    expect(partners.size).toBe(18 * 17 / 2)
  })

  it('constructs complete chronological rotations for 32 players on seven courts', () => {
    const roster = players(32)
    const plan = buildAmericanoCycle(roster, 7, [], 2026)
    verifyCycle(plan, roster, 7, 7)
    expect(plan).toHaveLength(248)
    const counts = new Map<string, number>()
    for (const round of plan) {
      expect(round.matches).toHaveLength(7)
      for (const match of round.matches) for (const team of [match.teamAPlayerIds, match.teamBPlayerIds]) {
        const key = pairKey(team)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const minimum = counts.size < 496 ? 0 : Math.min(...counts.values())
      expect(Math.max(...counts.values()) - minimum).toBeLessThanOrEqual(1)
    }
  })

  it.each([0, 1, 2, 3, 4.5, NaN])('rejects unsupported player count %s', (count) => {
    expect(isFullAmericanoCyclePossible(count)).toBe(false)
    if (Number.isInteger(count) && count >= 0) expect(() => buildAmericanoCycle(players(count), 1, [], 1)).toThrow(/at least four players/)
  })

  it.each([0, -1, 1.5, NaN])('rejects invalid court count %s', (courts) => {
    expect(() => buildAmericanoCycle(players(8), courts, [], 1)).toThrow(/court/)
  })
})
