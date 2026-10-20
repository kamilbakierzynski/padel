import type { IndexedGame } from './americano-designs'

interface LiftChoice {
  games: IndexedGame[]
  source: IndexedGame[] | null
}

/**
 * Keep full source rounds and move a small number of games into overflow rounds.
 * Input factors must contain disjoint players. The result consumes every input
 * game once and has ceil(gameCount / courts) rounds, with only its last possibly
 * short. Bounded backtracking returns null instead of weakening those guarantees.
 */
export function packDesignRounds(
  design: IndexedGame[][],
  playerCount: number,
  courts: number,
): IndexedGame[][] | null {
  if (!Number.isInteger(courts) || courts < 1 || courts * 4 > playerCount) return null
  const choices: LiftChoice[] = []
  const retained: IndexedGame[][] = []
  for (const factor of design) {
    const players = factor.flat(2)
    if (new Set(players).size !== players.length ||
      players.some((player) => !Number.isInteger(player) || player < 0 || player >= playerCount)) return null
    // A larger source factor can be divided into independent groups with one
    // surplus game each. Short factors contribute their games as forced lifts.
    let start = 0
    while (factor.length - start > courts) {
      const group = factor.slice(start, start + courts + 1)
      choices.push({ games: group, source: group })
      start += courts + 1
    }
    const tail = factor.slice(start)
    if (tail.length === courts) retained.push(tail)
    else for (const game of tail) choices.push({ games: [game], source: null })
  }
  if (!choices.length) return retained

  const binCount = Math.ceil(choices.length / courts)
  const capacities = Array.from({ length: binCount }, (_, index) =>
    index === binCount - 1 ? choices.length - index * courts : courts)
  const bins: IndexedGame[][] = capacities.map(() => [])
  const usedPlayers = capacities.map(() => new Set<number>())
  const selected = Array<number>(choices.length).fill(-1)
  const gamePlayers = choices.map((choice) => choice.games.map((game) => game.flat()))
  let visits = 0
  let checks = 0
  const exhausted = () => visits > 60_000 || checks > 5_000_000

  const visit = (left: number): boolean => {
    if (!left) return true
    visits += 1
    if (exhausted()) return false
    let next = -1
    let placements: [number, number][] = []
    // Choose the source with the fewest remaining game/bin alternatives. Empty
    // overflow rounds of equal capacity are interchangeable and visited once.
    for (let choice = 0; choice < choices.length; choice += 1) {
      if (selected[choice] !== -1) continue
      const possible: [number, number][] = []
      const emptyCapacities = new Set<number>()
      for (let bin = 0; bin < binCount; bin += 1) {
        if (bins[bin].length === capacities[bin]) continue
        if (!bins[bin].length) {
          if (emptyCapacities.has(capacities[bin])) continue
          emptyCapacities.add(capacities[bin])
        }
        for (let game = 0; game < choices[choice].games.length; game += 1) {
          checks += 1
          if (gamePlayers[choice][game].every((player) => !usedPlayers[bin].has(player))) possible.push([bin, game])
        }
      }
      if (!possible.length || exhausted()) return false
      if (next === -1 || possible.length < placements.length) { next = choice; placements = possible }
    }
    placements.sort(([a], [b]) => bins[b].length - bins[a].length || capacities[b] - capacities[a] || a - b)
    for (const [bin, game] of placements) {
      selected[next] = game
      bins[bin].push(choices[next].games[game])
      for (const player of gamePlayers[next][game]) usedPlayers[bin].add(player)
      if (visit(left - 1)) return true
      for (const player of gamePlayers[next][game]) usedPlayers[bin].delete(player)
      bins[bin].pop()
      selected[next] = -1
      if (exhausted()) return false
    }
    return false
  }
  if (!visit(choices.length)) return null
  choices.forEach((choice, index) => {
    if (choice.source) retained.push(choice.source.filter((_, game) => game !== selected[index]))
  })
  return [...retained, ...bins]
}

/**
 * Consume complete designs in order. A short final round of one design may use
 * games from the next, but no other games from that next design move earlier.
 * Both lifting and bridge alternatives have deterministic work limits.
 */
export function packDesignCycles(
  designs: IndexedGame[][][],
  playerCount: number,
  courts: number,
): IndexedGame[][] | null {
  if (!Number.isInteger(courts) || courts < 1 || courts * 4 > playerCount) return null
  const total = designs.reduce((sum, design) => sum + design.reduce((count, factor) => count + factor.length, 0), 0)
  if (total % courts) return null
  for (const factor of designs.flat()) {
    const players = factor.flat(2)
    if (new Set(players).size !== players.length ||
      players.some((player) => !Number.isInteger(player) || player < 0 || player >= playerCount)) return null
  }
  if (!total) return []
  let packingCalls = 0
  let bridgeBranches = 0
  let bridgeChecks = 0
  const maximumCalls = playerCount <= 24 ? 24 : 6
  const maximumAlternatives = playerCount <= 24 ? 8 : 3
  const exhausted = () => packingCalls >= maximumCalls || bridgeBranches >= 128 || bridgeChecks >= 30_000

  const chain = (cycle: number, current: IndexedGame[][]): IndexedGame[][] | null => {
    for (let attempt = 0; attempt < maximumAlternatives && !exhausted(); attempt += 1) {
      // A different source/game ordering gives the bounded lift search another
      // trailing partial without changing any partnerships or oppositions.
      const ordered = Array.from({ length: current.length }, (_, offset) => {
        const factor = current[(offset + attempt) % current.length]
        const shift = factor.length ? attempt % factor.length : 0
        return [...factor.slice(shift), ...factor.slice(0, shift)]
      })
      if (attempt % 2) ordered.reverse()
      packingCalls += 1
      const packed = packDesignRounds(ordered, playerCount, courts)
      if (!packed) continue
      const tail = packed.at(-1) ?? []
      if (cycle === designs.length - 1) return !tail.length || tail.length === courts ? packed : null
      if (!tail.length || tail.length === courts) {
        const next = chain(cycle + 1, designs[cycle + 1])
        if (next) return [...packed, ...next]
        continue
      }

      const nextDesign = designs[cycle + 1]
      const occupied = new Set(tail.flat(2))
      const candidates = nextDesign.flatMap((factor, factorIndex) => factor.map((game, gameIndex) => ({
        game, factorIndex, gameIndex, players: game.flat(),
      }))).filter(({ players }) => players.every((player) => !occupied.has(player)))
      const selected: number[] = []
      const fill = (start: number): IndexedGame[][] | null => {
        if (tail.length + selected.length === courts) {
          bridgeBranches += 1
          if (exhausted()) return null
          const removed = new Set(selected.map((index) => `${candidates[index].factorIndex}:${candidates[index].gameIndex}`))
          const remaining = nextDesign.map((factor, factorIndex) =>
            factor.filter((_, gameIndex) => !removed.has(`${factorIndex}:${gameIndex}`)))
          const next = chain(cycle + 1, remaining)
          if (next) return [...packed.slice(0, -1), [...tail, ...selected.map((index) => candidates[index].game)], ...next]
          return null
        }
        const needed = courts - tail.length - selected.length
        const options = Array.from({ length: Math.max(0, candidates.length - start - needed + 1) }, (_, index) => start + index)
        // Removing one game from each surplus factor leaves those factors full.
        // Prefer this over making one source factor short, but keep both options.
        options.sort((a, b) => Number(selected.some((index) => candidates[index].factorIndex === candidates[a].factorIndex)) -
          Number(selected.some((index) => candidates[index].factorIndex === candidates[b].factorIndex)) || a - b)
        for (const index of options) {
          bridgeChecks += 1
          if (exhausted()) return null
          const candidate = candidates[index]
          if (candidate.players.some((player) => occupied.has(player))) continue
          selected.push(index)
          candidate.players.forEach((player) => occupied.add(player))
          const result = fill(index + 1)
          if (result) return result
          candidate.players.forEach((player) => occupied.delete(player))
          selected.pop()
        }
        return null
      }
      const result = fill(0)
      if (result) return result
    }
    return null
  }
  return chain(0, designs[0])
}
