import { describe, expect, it } from 'vitest'

import { buildAmericanoPartnerships } from './americano-partnerships'

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }

function verify(count: number, courts: number, seed: number) {
  const rounds = buildAmericanoPartnerships(count, courts, seed)
  const edgeCount = count * (count - 1) / 2
  const rotations = courts * 2 / gcd(courts * 2, edgeCount)
  expect(rounds).toHaveLength(edgeCount * rotations / (courts * 2))
  for (const round of rounds) {
    expect(round).toHaveLength(courts * 2)
    expect(new Set(round.flat()).size).toBe(courts * 4)
    expect(round.flat().every((player) => Number.isInteger(player) && player >= 0 && player < count)).toBe(true)
  }
  const teams = rounds.flat()
  for (let start = 0; start < teams.length; start += edgeCount) {
    const cycle = teams.slice(start, start + edgeCount)
    const partners = new Set(cycle.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`))
    expect(partners.size).toBe(edgeCount)
    const appearances = Array<number>(count).fill(0)
    for (const [a, b] of cycle) { appearances[a] += 1; appearances[b] += 1 }
    expect(new Set(appearances)).toEqual(new Set([count - 1]))
  }
  return rounds
}

describe('constructive Americano partnership scheduling', () => {
  it.each([[32, 7, 7], [28, 6, 2], [33, 7, 7], [20, 4, 4], [16, 3, 1], [12, 2, 2], [13, 2, 2]])(
    'fills courts and preserves exact chronological rotations for %i players / %i courts', (count, courts, rotations) => {
      const rounds = verify(count, courts, 12345)
      expect(rounds.flat()).toHaveLength(count * (count - 1) / 2 * rotations)
    },
  )

  it.each([4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 28, 29, 32, 33, 40, 41, 64, 65])(
    'constructs every playable court count for %i players without search or retries', (count) => {
      for (let courts = 1; courts <= Math.floor(count / 4); courts += 1) verify(count, courts, count * 100 + courts)
    },
  )

  it.each([0, 1, 2, 123, 9999, 4294967295])('keeps boundary-round players distinct for seed %i', (seed) => {
    verify(32, 7, seed)
    verify(33, 7, seed)
  })

  it('is deterministic and varies with the seed', () => {
    const first = buildAmericanoPartnerships(32, 7, 123)
    expect(buildAmericanoPartnerships(32, 7, 123)).toEqual(first)
    expect(buildAmericanoPartnerships(32, 7, 124)).not.toEqual(first)
  })

  it.each([0, 3, 6, 7, 10, 11, 4.5, NaN])('rejects unsupported player count %s', (count) => {
    expect(() => buildAmericanoPartnerships(count, 1, 1)).toThrow(/players/)
  })

  it.each([0, -1, 3, 1.5, NaN])('rejects invalid court count %s', (courts) => {
    expect(() => buildAmericanoPartnerships(8, courts, 1)).toThrow(/courts/)
  })
})
