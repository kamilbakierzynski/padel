import { describe, expect, it } from 'vitest'

import { buildBalancedDesign, type IndexedGame } from './americano-designs'
import { packDesignCycles, packDesignRounds } from './americano-lift'

function verify(design: IndexedGame[][], count: number, courts: number): void {
  const before = JSON.stringify(design)
  const result = packDesignRounds(design, count, courts)
  expect(result === null).toBe(false)
  expect(result!).toHaveLength(Math.ceil(design.flat().length / courts))
  expect(result!.flat().map((game) => JSON.stringify(game)).sort())
    .toEqual(design.flat().map((game) => JSON.stringify(game)).sort())
  result!.forEach((round, index) => {
    expect(round).toHaveLength(index === result!.length - 1 ? design.flat().length % courts || courts : courts)
    expect(new Set(round.flat(2)).size).toBe(round.length * 4)
  })
  expect(JSON.stringify(design)).toBe(before)
}

describe('packing design factors by lifting surplus games', () => {
  it.each([[12, 2], [16, 3], [20, 4], [20, 3], [20, 2]])('packs %i-player whist factors into %i courts', (count, courts) => {
    verify(buildBalancedDesign(count)!, count, courts)
  })

  it.each([1, 4, 11])('preserves the twenty-player design under relabelling by %i', (shift) => {
    const design = buildBalancedDesign(20)!.map((factor) => factor.map((game) =>
      game.map((team) => team.map((player) => (player + shift) % 20)) as IndexedGame))
    verify(design, 20, 4)
  })

  it('accepts source factors shortened by bridge games', () => {
    const design = buildBalancedDesign(20)!
    design[0].pop()
    design[1].pop()
    design[2].pop()
    verify(design, 20, 4)
  })

  it('preserves already full factors without searching', () => {
    verify(buildBalancedDesign(20)!, 20, 5)
  })

  it('rejects invalid factors instead of returning overlapping matches', () => {
    const game: IndexedGame = [[0, 1], [2, 3]]
    expect(packDesignRounds([[game, game]], 8, 2)).toBeNull()
  })
})

describe('chronological design-cycle packing', () => {
  it.each([1, 2026])('chains shuffled twenty-player rotations for seed %i', (seed) => {
    let state = seed
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
    const designs = Array.from({ length: 4 }, () => {
      const labels = Array.from({ length: 20 }, (_, index) => index)
      for (let index = labels.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1))
        ;[labels[index], labels[other]] = [labels[other], labels[index]]
      }
      return buildBalancedDesign(20)!.map((factor) => factor.map((game) =>
        game.map((team) => team.map((player) => labels[player])) as IndexedGame))
    })
    const packed = packDesignCycles(designs, 20, 4)
    expect(packed === null).toBe(false)
    expect(packed!).toHaveLength(95)
    expect(new Set(packed!.flat()).size).toBe(380)
    const gameCycles = new Map(designs.flatMap((design, cycle) => design.flat().map((game) => [game, cycle] as const)))
    const sequence = packed!.flat().map((game) => gameCycles.get(game)!)
    expect(sequence).toEqual([...sequence].sort((a, b) => a - b))
    expect(packed!.every((round) => round.length === 4 && new Set(round.flat(2)).size === 16)).toBe(true)
  })

  it.each([[20, 4, 4], [12, 2, 2]])('chains %i players / %i courts over %i rotations', (count, courts, cycles) => {
    const designs = Array.from({ length: cycles }, (_, cycle) => buildBalancedDesign(count)!.map((factor) =>
      factor.map((game) => game.map((team) => team.map((player) => (player + cycle) % count)) as IndexedGame)))
    const before = JSON.stringify(designs)
    const gameCycles = new Map(designs.flatMap((design, cycle) => design.flat().map((game) => [game, cycle] as const)))
    const packed = packDesignCycles(designs, count, courts)
    expect(packed === null).toBe(false)
    expect(packed!).toHaveLength(designs.flat(2).length / courts)
    for (const round of packed!) {
      expect(round).toHaveLength(courts)
      expect(new Set(round.flat(2)).size).toBe(courts * 4)
      const sourceCycles = round.map((game) => gameCycles.get(game)!)
      expect(Math.max(...sourceCycles) - Math.min(...sourceCycles)).toBeLessThanOrEqual(1)
    }
    const orderedCycles = packed!.flat().map((game) => gameCycles.get(game)!)
    expect(orderedCycles).toEqual([...orderedCycles].sort((a, b) => a - b))
    expect(new Set(packed!.flat()).size).toBe(designs.flat(2).length)
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const partners = packed!.flat().filter((game) => gameCycles.get(game) === cycle)
        .flatMap((game) => game.map((team) => [...team].sort((a, b) => a - b).join(',')))
      expect(partners).toHaveLength(count * (count - 1) / 2)
      expect(new Set(partners).size).toBe(partners.length)
    }
    expect(JSON.stringify(designs)).toBe(before)
  })

  it('declines an incomplete final round rather than changing a design', () => {
    expect(packDesignCycles([buildBalancedDesign(20)!], 20, 4)).toBeNull()
  })
})
