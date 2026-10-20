import { describe, expect, it } from 'vitest'

import { buildBalancedDesign } from './americano-designs'

describe('exact balanced Americano designs', () => {
  it.each([4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24, 25, 29, 37, 41, 49, 53, 61, 65, 73, 81, 85, 89, 97, 101, 109, 113, 121, 125])(
    'covers every partnership once and opposition twice for %i players', (count) => {
      const rounds = buildBalancedDesign(count)!
      expect(rounds).not.toBeNull()
      expect(rounds).toHaveLength(count % 2 === 0 ? count - 1 : count)
      const partners = Array.from({ length: count }, () => Array<number>(count).fill(0))
      const opponents = Array.from({ length: count }, () => Array<number>(count).fill(0))
      const appearances = Array<number>(count).fill(0)
      for (const round of rounds) {
        expect(round).toHaveLength(Math.floor(count / 4))
        const active = round.flat(2)
        expect(new Set(active).size).toBe(active.length)
        expect(active.every((player) => Number.isInteger(player) && player >= 0 && player < count)).toBe(true)
        for (const player of active) {
          appearances[player] += 1
        }
        for (const [a, b] of round) {
          for (const team of [a, b]) {
            partners[team[0]][team[1]] += 1
            partners[team[1]][team[0]] += 1
          }
          for (const first of a) for (const second of b) {
            opponents[first][second] += 1
            opponents[second][first] += 1
          }
        }
      }
      expect(new Set(appearances)).toEqual(new Set([count - 1]))
      for (let first = 0; first < count; first += 1) {
        expect(partners[first]).toEqual(Array.from({ length: count }, (_, second) => first === second ? 0 : 1))
        expect(opponents[first]).toEqual(Array.from({ length: count }, (_, second) => first === second ? 0 : 2))
      }
    },
  )

  it.each([0, 3, 6, 7, 10, 11, 28, 33, 129, 4.5, NaN, Infinity])(
    'returns null for unsupported size %s', (count) => {
      expect(buildBalancedDesign(count)).toBeNull()
    },
  )

  it('returns independent arrays so relabeling a cycle cannot mutate the template', () => {
    const first = buildBalancedDesign(12)!
    const expected = structuredClone(first)
    first[0][0][0][0] = 99
    first.reverse()
    expect(buildBalancedDesign(12)).toEqual(expected)
  })
})
