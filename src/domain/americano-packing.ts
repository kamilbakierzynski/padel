import { packDesignCycles } from './americano-lift'
import type { IndexedGame } from './americano-designs'
export type { IndexedGame } from './americano-designs'

type Cost = number[]

function compare(a: Cost, b: Cost): number {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Pack fixed games without changing partners or opponents. Every returned round
 * fills every court; a bounded search that cannot find a cover returns null.
 * History uses zero-based player indexes and one-based last-played rounds (zero
 * means never). Passing completedRounds retains leading/trailing historical byes.
 */
export function packAmericanoGames(
  games: IndexedGame[],
  playerCount: number,
  courts: number,
  appearances: number[],
  lastPlayed: number[],
  seed: number,
  completedRounds = Math.max(0, ...lastPlayed),
  gamePreferences?: number[][],
  gamesPerCycle?: number,
): IndexedGame[][] | null {
  if (!Number.isInteger(courts) || courts < 1 || courts * 4 > playerCount || games.length % courts) return null
  if (appearances.length !== playerCount || lastPlayed.length !== playerCount) return null
  if (!games.length) return []
  const players = games.map((game) => game.flat())
  const cycleOf = (index: number) => gamesPerCycle ? Math.floor(index / gamesPerCycle) : 0
  if (players.some((group) => new Set(group).size !== 4 ||
    group.some((player) => !Number.isInteger(player) || player < 0 || player >= playerCount))) return null

  const sourceRounds = Array.from({ length: games.length / courts }, (_, round) =>
    Array.from({ length: courts }, (_, court) => round * courts + court))
  // Constructive schedules can contain thousands of games. Validate their
  // existing groups in linear space before considering a compatibility matrix.
  const sourceIsPacked = sourceRounds.every((group) =>
    new Set(group.flatMap((index) => players[index])).size === courts * 4)
  let readyRounds: number[][] | null = sourceIsPacked ? sourceRounds : null
  if (!readyRounds && gamesPerCycle && games.length % gamesPerCycle === 0) {
    const perFactor = Math.floor(playerCount / 4)
    const designs = Array.from({ length: games.length / gamesPerCycle }, (_, cycle) => {
      const pool = games.slice(cycle * gamesPerCycle, (cycle + 1) * gamesPerCycle)
      return Array.from({ length: pool.length / perFactor }, (_, factor) =>
        pool.slice(factor * perFactor, (factor + 1) * perFactor))
    })
    const lifted = packDesignCycles(designs, playerCount, courts)
    if (lifted) {
      const indexes = new Map(games.map((game, index) => [game, index]))
      readyRounds = lifted.map((round) => round.map((game) => indexes.get(game)!))
    }
  }
  // The caller can construct a guaranteed cover for large pools. Leave that
  // fallback to it rather than allocating quadratic memory for bounded search.
  if (!readyRounds && games.length > 600) return null
  const compatible = readyRounds ? [] : players.map((group) =>
    players.map((other) => !group.some((player) => other.includes(player))))
  const random = randomGenerator(seed)
  const tie = games.map(() => random())
  let remaining = games.map((_, index) => index)
  const partition: number[][] = []
  const failed = new Set<string>()
  let visits = 0
  let combinations = 0
  let compatibilityChecks = 0
  const exhausted = () => visits > 12_000 || combinations > 300_000 || compatibilityChecks > 12_000_000

  // Most-constrained-game exact cover. Groups are generated lazily, so large
  // fields never materialize the exponential set of possible full rounds.
  const cover = (): boolean => {
    if (!remaining.length) return true
    visits += 1
    compatibilityChecks += remaining.length * remaining.length
    if (exhausted()) return false
    const key = remaining.join(',')
    if (failed.has(key)) return false
    // Finish the earliest rotation before taking games from the next one.
    // Only its final incomplete round may cross the boundary.
    const earliest = cycleOf(remaining[0])
    const current = remaining.filter((index) => cycleOf(index) === earliest)
    const crossing = current.length < courts
    const eligible = remaining.filter((index) => cycleOf(index) === earliest ||
      (crossing && cycleOf(index) === earliest + 1))
    const degrees = new Map(eligible.map((index) => [index,
      eligible.reduce((total, other) => total + Number(compatible[index][other]), 0)]))
    const anchor = current.reduce((best, index) => degrees.get(index)! < degrees.get(best)! ? index : best)
    if (degrees.get(anchor)! < courts - 1) return false
    const options = eligible.filter((index) => compatible[anchor][index])
      .sort((a, b) => degrees.get(a)! - degrees.get(b)! || tie[a] - tie[b])
    const groups: number[][] = []
    const enumerate = (chosen: number[], start: number): void => {
      if (++combinations > 300_000 || groups.length >= 192) return
      if (chosen.length === courts) {
        if (!crossing || current.every((index) => chosen.includes(index))) groups.push([...chosen])
        return
      }
      for (let position = start; position <= options.length - (courts - chosen.length); position += 1) {
        const next = options[position]
        if (chosen.every((index) => compatible[index][next])) enumerate([...chosen, next], position + 1)
        if (groups.length >= 192 || combinations > 300_000) break
      }
    }
    // The source normally consists of disjoint design rounds. Try preserving a
    // contiguous group first; this makes full-capacity and divisible cases cheap.
    const sourceStart = Math.floor(anchor / courts) * courts
    const sourceGroup = Array.from({ length: courts }, (_, index) => sourceStart + index)
    if (sourceGroup.every((index) => eligible.includes(index)) &&
      (!crossing || current.every((index) => sourceGroup.includes(index))) &&
      sourceGroup.every((index, position) => sourceGroup.slice(position + 1).every((other) => compatible[index][other]))) {
      groups.push(sourceGroup)
    }
    enumerate([anchor], 0)
    const previous = remaining
    for (const group of groups) {
      remaining = previous.filter((index) => !group.includes(index))
      partition.push(group)
      if (cover()) return true
      partition.pop()
      if (exhausted()) break
    }
    remaining = previous
    if (failed.size < 12_000) failed.add(key)
    return false
  }
  if (readyRounds) {
    partition.push(...readyRounds)
  } else if (!cover()) return null

  const phases = partition.map((group) => {
    const first = Math.min(...group.map(cycleOf)), last = Math.max(...group.map(cycleOf))
    return first * 2 + Number(last !== first)
  })

  if (courts * 4 === playerCount) {
    // Everyone plays every round, so every ordering has identical appearance
    // balance and rest costs. Only historical game preferences can distinguish
    // orders; sorting avoids the general fairness search entirely.
    const preferences = partition.map((group) => [0, 1, 2].map((column) =>
      group.reduce((sum, game) => sum + (gamePreferences?.[game]?.[column] ?? 0), 0)))
    const priority = partition.map(() => random())
    return partition.map((_, index) => index)
      .sort((a, b) => phases[a] - phases[b] || compare(preferences[a], preferences[b]) || priority[a] - priority[b])
      .map((index) => partition[index].map((game) => games[game]))
  }

  const active = partition.map((group) => new Set(group.flatMap((index) => players[index])))
  const initialSpread = Math.max(...appearances) - Math.min(...appearances)
  const score = (order: number[]): Cost => {
    const counts = [...appearances]
    const last = [...lastPlayed]
    let worstSpread = 0
    let imbalance = 0
    let restPenalty = 0
    let playPenalty = 0
    const preference = [0, 0, 0]
    const streaks = last.map((round) => Number(round === completedRounds))
    order.forEach((index, offset) => {
      const round = completedRounds + offset + 1
      for (let player = 0; player < playerCount; player += 1) {
        if (active[index].has(player)) {
          counts[player] += 1
          last[player] = round
          streaks[player] += 1
          playPenalty += Math.max(0, streaks[player] - 2)
        } else {
          streaks[player] = 0
          restPenalty += Math.max(0, round - last[player] - 1) ** 2
        }
      }
      const spread = Math.max(...counts) - Math.min(...counts)
      worstSpread = Math.max(worstSpread, spread - Math.max(1, initialSpread))
      const total = counts.reduce((sum, count) => sum + count, 0)
      imbalance += playerCount * counts.reduce((sum, count) => sum + count * count, 0) - total * total
      for (const game of partition[index]) {
        preference[0] += (gamePreferences?.[game]?.[0] ?? 0) * (partition.length - offset)
        preference[1] += (gamePreferences?.[game]?.[1] ?? 0) * (partition.length - offset)
        if (offset === 0) preference[2] += gamePreferences?.[game]?.[2] ?? 0
      }
    })
    return [worstSpread, imbalance, restPenalty, playPenalty, ...preference]
  }

  // Reordering preserves the exact cover. Greedy prefix balancing uses the
  // entire history; deterministic restarts and bounded pair swaps then repair
  // choices whose consequences only become visible later in the schedule.
  // Keep the constructive order as a candidate too: consecutive source factors
  // already give excellent rest balance, particularly on a single court.
  let bestOrder = partition.map((_, index) => index).sort((a, b) => phases[a] - phases[b])
  let bestCost = score(bestOrder)
  const attempts = partition.length <= 40 ? (courts === 1 ? 2 : 6) : partition.length <= 120 ? 2 : 1
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const available = partition.map((_, index) => index)
    const order: number[] = []
    const priority = partition.map(() => random())
    const counts = [...appearances]
    const last = [...lastPlayed]
    const streaks = last.map((round) => Number(round === completedRounds))
    let worstSpread = 0
    while (available.length) {
      let selected = 0
      let selectedCost: Cost = Array(7).fill(Infinity)
      const roundNumber = completedRounds + order.length + 1
      const phase = Math.min(...available.map((index) => phases[index]))
      available.forEach((index, position) => {
        if (phases[index] !== phase) return
        const nextCounts = counts.map((count, player) => count + Number(active[index].has(player)))
        const spread = Math.max(...nextCounts) - Math.min(...nextCounts)
        const total = nextCounts.reduce((sum, count) => sum + count, 0)
        let restPenalty = 0
        let playPenalty = 0
        for (let player = 0; player < playerCount; player += 1) {
          if (active[index].has(player)) playPenalty += Math.max(0, streaks[player] - 1)
          else restPenalty += Math.max(0, roundNumber - last[player] - 1) ** 2
        }
        const preference = [0, 0, 0]
        for (const game of partition[index]) {
          preference[0] += gamePreferences?.[game]?.[0] ?? 0
          preference[1] += gamePreferences?.[game]?.[1] ?? 0
          if (!order.length) preference[2] += gamePreferences?.[game]?.[2] ?? 0
        }
        const cost = [Math.max(worstSpread, spread - Math.max(1, initialSpread)),
          playerCount * nextCounts.reduce((sum, count) => sum + count * count, 0) - total * total,
          restPenalty, playPenalty, ...preference]
        if (compare(cost, selectedCost) < 0 ||
          (compare(cost, selectedCost) === 0 && priority[index] < priority[available[selected]])) {
          selected = position
          selectedCost = cost
        }
      })
      const chosen = available.splice(selected, 1)[0]
      order.push(chosen)
      worstSpread = selectedCost[0]
      for (let player = 0; player < playerCount; player += 1) {
        if (active[chosen].has(player)) {
          counts[player] += 1
          last[player] = roundNumber
          streaks[player] += 1
        } else streaks[player] = 0
      }
    }
    let cost = score(order)
    if (partition.length <= (courts === 1 ? 32 : 60)) {
      for (let pass = 0; pass < (courts === 1 ? 1 : 3); pass += 1) {
        let improved = false
        for (let first = 0; first < order.length - 1; first += 1) {
          for (let second = first + 1; second < order.length; second += 1) {
            if (phases[order[first]] !== phases[order[second]]) continue
            ;[order[first], order[second]] = [order[second], order[first]]
            const next = score(order)
            if (compare(next, cost) < 0) { cost = next; improved = true }
            else [order[first], order[second]] = [order[second], order[first]]
          }
        }
        if (!improved) break
      }
    }
    if (compare(cost, bestCost) < 0) { bestOrder = [...order]; bestCost = cost }
  }

  // A greedy order can get trapped even when the same fixed rounds admit an
  // appearance spread of one. For small schedules, search feasible prefixes
  // directly; the played counts depend only on the remaining set, so failed
  // subsets can be memoized without considering every permutation.
  if (bestCost[0] > 0 && partition.length <= 32) {
    const counts = [...appearances]
    const last = [...lastPlayed]
    const failed = new Set<string>()
    let visits = 0
    const limit = Math.max(1, initialSpread)
    const visitLimit = courts === 1 ? 3_000 : 30_000
    const search = (remaining: number[], order: number[]): number[] | null => {
      if (!remaining.length) return order
      if (++visits > visitLimit) return null
      const key = remaining.join(',')
      if (failed.has(key)) return null
      const phase = Math.min(...remaining.map((index) => phases[index]))
      const round = completedRounds + order.length + 1
      const candidates = remaining.filter((index) => phases[index] === phase).map((index) => {
        const next = counts.map((count, player) => count + Number(active[index].has(player)))
        return { index, next, rest: last.reduce((sum, played, player) =>
          sum + (active[index].has(player) ? 0 : Math.max(0, round - played - 1) ** 2), 0) }
      }).filter(({ next }) => Math.max(...next) - Math.min(...next) <= limit)
        .sort((a, b) => a.rest - b.rest || bestOrder.indexOf(a.index) - bestOrder.indexOf(b.index))
      for (const { index } of candidates) {
        const previousLast = [...last]
        for (const player of active[index]) { counts[player] += 1; last[player] = round }
        const found = search(remaining.filter((value) => value !== index), [...order, index])
        for (const player of active[index]) { counts[player] -= 1; last[player] = previousLast[player] }
        if (found) return found
        if (visits > visitLimit) break
      }
      failed.add(key)
      return null
    }
    const fair = search(partition.map((_, index) => index), [])
    if (fair) { bestOrder = fair; bestCost = score(fair) }
  }

  // Some covers themselves prevent fair prefixes, regardless of round order.
  // For small two-court fields, jointly choose games and chronology before
  // accepting a larger appearance gap (notably ten/eleven-player tournaments).
  if (bestCost[0] > 0 && courts === 2 && games.length <= 60) {
    const counts = [...appearances], last = [...lastPlayed]
    const limit = Math.max(1, initialSpread)
    const bits = games.map((_, index) => 1n << BigInt(index))
    const groups: { indexes: number[]; players: number[]; mask: bigint }[] = []
    for (let a = 0; a < games.length; a += 1) for (let b = a + 1; b < games.length; b += 1) {
      const members = [...players[a], ...players[b]]
      if (new Set(members).size === 8) groups.push({ indexes: [a, b], players: members, mask: bits[a] | bits[b] })
    }
    const failed = new Set<bigint>()
    let visits = 0
    const search = (remaining: bigint, order: number[][]): number[][] | null => {
      if (remaining === 0n) return order
      if (++visits > 30_000 || failed.has(remaining)) return null
      const unused = games.map((_, index) => index).filter((index) => (remaining & bits[index]) !== 0n)
      const earliest = cycleOf(unused[0])
      const current = unused.filter((index) => cycleOf(index) === earliest)
      const round = completedRounds + order.length + 1
      const candidates = groups.filter((group) => (remaining & group.mask) === group.mask &&
        (current.length >= courts ? group.indexes.every((index) => cycleOf(index) === earliest) :
          current.every((index) => group.indexes.includes(index)) && group.indexes.every((index) => cycleOf(index) <= earliest + 1)))
        .map((group) => {
          const next = counts.map((count, player) => count + Number(group.players.includes(player)))
          const rest = last.reduce((sum, played, player) =>
            sum + (group.players.includes(player) ? 0 : Math.max(0, round - played - 1) ** 2), 0)
          return { group, next, rest }
        }).filter(({ next }) => Math.max(...next) - Math.min(...next) <= limit)
        .sort((a, b) => a.rest - b.rest || tie[a.group.indexes[0]] - tie[b.group.indexes[0]])
      for (const { group } of candidates) {
        const previousLast = [...last]
        for (const player of group.players) { counts[player] += 1; last[player] = round }
        const found = search(remaining ^ group.mask, [...order, group.indexes])
        for (const player of group.players) { counts[player] -= 1; last[player] = previousLast[player] }
        if (found) return found
        if (visits > 30_000) break
      }
      failed.add(remaining)
      return null
    }
    const fair = search((1n << BigInt(games.length)) - 1n, [])
    if (fair) return fair.map((group) => group.map((index) => games[index]))
  }
  return bestOrder.map((index) => partition[index].map((game) => games[game]))
}
