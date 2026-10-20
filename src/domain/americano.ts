import type { Player, Round } from './types'
import { buildBalancedDesign, type IndexedGame } from './americano-designs'
import { packAmericanoGames } from './americano-packing'
import { buildAmericanoPartnerships } from './americano-partnerships'

export interface AmericanoMatchPlan {
  teamAPlayerIds: [string, string]
  teamBPlayerIds: [string, string]
}
export interface AmericanoRoundPlan {
  matches: AmericanoMatchPlan[]
  byePlayerIds: string[]
}
export const AMERICANO_PLAN_VERSION = 2
type Team = [number, number]
type Game = IndexedGame
interface PreviousGame { count: number; lastRound: number }
interface History {
  games: Map<string, PreviousGame>
  partners: Map<string, number>
  opponents: Map<string, number>
  appearances: number[]
  lastPlayed: number[]
  lastPartners: Set<string>
}

export function isFullAmericanoCyclePossible(playerCount: number): boolean {
  return Number.isInteger(playerCount) && playerCount >= 4 && (playerCount % 4 === 0 || playerCount % 4 === 1)
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
function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}
function pairKey(a: number, b: number): string { return a < b ? `${a},${b}` : `${b},${a}` }
function gameKey([a, b]: Game): string { return [pairKey(...a), pairKey(...b)].sort().join('|') }
function opponentKeys([a, b]: Game): string[] { return a.flatMap((first) => b.map((second) => pairKey(first, second))) }
function increment(map: Map<string, number>, key: string) { map.set(key, (map.get(key) ?? 0) + 1) }
function compare(a: number[], b: number[]): number {
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index] - b[index]
  return 0
}
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }

function readHistory(players: Player[], rounds: Round[]): History {
  const indexes = new Map(players.map((player, index) => [player.id, index]))
  const history: History = {
    games: new Map(), partners: new Map(), opponents: new Map(),
    appearances: players.map(() => 0), lastPlayed: players.map(() => 0), lastPartners: new Set(),
  }
  rounds.forEach((round, roundIndex) => round.matches.forEach((match) => {
    const ids = [...match.teamAPlayerIds, ...match.teamBPlayerIds].map((id) => indexes.get(id))
    if (ids.some((id) => id === undefined)) return
    const game: Game = [[ids[0]!, ids[1]!], [ids[2]!, ids[3]!]]
    recordGame(history, game, roundIndex + 1)
    if (roundIndex === rounds.length - 1) for (const team of game) history.lastPartners.add(pairKey(...team))
  }))
  return history
}
function recordGame(history: History, game: Game, round: number) {
  const key = gameKey(game)
  history.games.set(key, { count: (history.games.get(key)?.count ?? 0) + 1, lastRound: round })
  for (const team of game) increment(history.partners, pairKey(...team))
  for (const opponent of opponentKeys(game)) increment(history.opponents, opponent)
  for (const player of game.flat()) { history.appearances[player] += 1; history.lastPlayed[player] = round }
}
function partnershipFactors(labels: number[]): Team[][] {
  const circle = [...labels]
  if (circle.length % 2) circle.push(-1)
  const factors: Team[][] = []
  for (let round = 0; round < circle.length - 1; round += 1) {
    const teams: Team[] = []
    for (let index = 0; index < circle.length / 2; index += 1) {
      const a = circle[index], b = circle[circle.length - 1 - index]
      if (a !== -1 && b !== -1) teams.push([a, b])
    }
    factors.push(teams)
    circle.splice(1, 0, circle.pop()!)
  }
  return factors
}

// Consuming all partnership edges guarantees coverage, including 4k+2/4k+3
// fields where one duplicate edge is needed to make the total even.
function pairTeams(teams: Team[], history: History, priorOpponents = new Map<string, number>()): Game[] | null {
  let visits = 0
  const opponents = new Map(priorOpponents)
  const visit = (remaining: Team[]): Game[] | null => {
    if (!remaining.length) return []
    if (++visits > 10_000) return null
    const first = remaining[0]
    const candidates = remaining.slice(1).map((team, index) => ({ team, index: index + 1 }))
      .filter(({ team }) => !team.some((player) => first.includes(player)))
      .map(({ team, index }) => {
        const game: Game = [first, team]
        return { game, index, cost: [
          opponentKeys(game).reduce((sum, key) => sum + 2 * (opponents.get(key) ?? 0) + 1, 0),
          history.games.get(gameKey(game))?.count ?? 0,
          opponentKeys(game).reduce((sum, key) => sum + (history.opponents.get(key) ?? 0), 0),
        ] }
      }).sort((a, b) => compare(a.cost, b.cost))
    for (const candidate of candidates) {
      for (const key of opponentKeys(candidate.game)) increment(opponents, key)
      const tail = visit(remaining.filter((_, index) => index !== 0 && index !== candidate.index))
      if (tail) return [candidate.game, ...tail]
      for (const key of opponentKeys(candidate.game)) opponents.set(key, opponents.get(key)! - 1)
      if (visits > 10_000) break
    }
    return null
  }
  return visit(teams)
}

function selectCycle(count: number, history: History, random: () => number): Game[][] {
  const template = buildBalancedDesign(count)
  const labels = Array.from({ length: count }, (_, index) => index)
  const complete = isFullAmericanoCyclePossible(count)
  // For incomplete fields, evaluate coverage and court/rest feasibility
  // together in the outer search instead of discarding fair candidates here.
  const attempts = template ? (count <= 9 ? 512 : 128) : complete ? 32 : 1
  let best: Game[][] | null = null
  let bestCost = [Infinity, Infinity, Infinity, Infinity, Infinity]
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const order = shuffle(labels, random)
    let candidate: Game[][]
    if (template) {
      candidate = template.map((round) => round.map(([a, b]) => [
        [order[a[0]], order[a[1]]], [order[b[0]], order[b[1]]],
      ] as Game))
    } else if (complete) {
      candidate = []
      const opponents = new Map<string, number>()
      for (const teams of shuffle(partnershipFactors(order), random)) {
        const games = pairTeams(teams, history, opponents)
        if (!games) throw new Error('Unable to pair a complete partnership factor.')
        candidate.push(games)
        for (const game of games) for (const key of opponentKeys(game)) increment(opponents, key)
      }
    } else {
      const teams = partnershipFactors(order).flat()
      // Give the two necessary extra appearances to the least-played players.
      const extra = [...teams].sort((a, b) =>
        Math.max(...a.map((id) => history.appearances[id])) - Math.max(...b.map((id) => history.appearances[id])) ||
        a.reduce((sum, id) => sum + history.appearances[id], 0) - b.reduce((sum, id) => sum + history.appearances[id], 0) ||
        (history.partners.get(pairKey(...a)) ?? 0) - (history.partners.get(pairKey(...b)) ?? 0))[0]
      const games = pairTeams(shuffle([...teams, extra], random), history)
      if (!games) continue
      candidate = games.map((game) => [game])
    }
    const opponents = new Map<string, number>()
    let repeats = 0, frequency = 0, recency = 0, historicalOpponents = 0
    for (const game of candidate.flat()) {
      const previous = history.games.get(gameKey(game))
      if (previous) { repeats += 1; frequency += previous.count; recency += previous.lastRound }
      for (const key of opponentKeys(game)) {
        increment(opponents, key)
        historicalOpponents += history.opponents.get(key) ?? 0
      }
    }
    const cost = [[...opponents.values()].reduce((sum, value) => sum + value * value, 0),
      repeats, frequency, recency, historicalOpponents]
    if (compare(cost, bestCost) < 0) { best = candidate; bestCost = cost }
    if (template && repeats === 0) break
  }
  if (!best) throw new Error('Unable to construct complete Americano partnerships.')
  validateCycle(best.flat(), count, Boolean(template))
  return best
}

function validateCycle(games: Game[], count: number, balanced: boolean) {
  const partners = new Map<string, number>(), opponents = new Map<string, number>()
  for (const game of games) {
    if (new Set(game.flat()).size !== 4) throw new Error('Americano game contains a duplicate player.')
    for (const team of game) increment(partners, pairKey(...team))
    for (const key of opponentKeys(game)) increment(opponents, key)
  }
  const pairCount = count * (count - 1) / 2
  const complete = isFullAmericanoCyclePossible(count)
  if (partners.size !== pairCount || games.length !== Math.ceil(pairCount / 2) ||
    [...partners.values()].some((value) => value < 1 || value > (complete ? 1 : 2))) {
    throw new Error('Invalid Americano partnership coverage.')
  }
  if (balanced && (opponents.size !== pairCount || [...opponents.values()].some((value) => value !== 2))) {
    throw new Error('Invalid Americano opposition balance.')
  }
}

// Large incomplete fields can exhaust fixed-game packing. Always make
// progress on an uncovered partnership while filling every court. This
// bounded fallback may need more than the theoretical minimum extra pair,
// but cannot strand a tournament or leave a partnership uncovered.
function coverageFallback(count: number, courts: number, history: History, random: () => number, roundOffset: number): Game[][] {
  const uncovered = new Map<string, Team>()
  for (let a = 0; a < count; a += 1) for (let b = a + 1; b < count; b += 1) uncovered.set(pairKey(a, b), [a, b])
  const rounds: Game[][] = []
  while (uncovered.size) {
    const anchor = shuffle([...uncovered.values()], random).sort((a, b) =>
      Math.max(...a.map((id) => history.appearances[id])) - Math.max(...b.map((id) => history.appearances[id])) ||
      a.reduce((sum, id) => sum + history.appearances[id], 0) - b.reduce((sum, id) => sum + history.appearances[id], 0))[0]
    const available = shuffle(Array.from({ length: count }, (_, index) => index), random)
      .filter((id) => !anchor.includes(id))
      .sort((a, b) => history.appearances[a] - history.appearances[b] || history.lastPlayed[a] - history.lastPlayed[b])
      .slice(0, courts * 4 - 2)
    const teams: Team[] = [anchor]
    while (available.length) {
      const first = available.shift()!
      available.sort((a, b) => Number(uncovered.has(pairKey(first, b))) - Number(uncovered.has(pairKey(first, a))) ||
        (history.partners.get(pairKey(first, a)) ?? 0) - (history.partners.get(pairKey(first, b)) ?? 0))
      teams.push([first, available.shift()!])
    }
    const games = pairTeams(teams, history)!
    rounds.push(games)
    for (const game of games) {
      for (const team of game) uncovered.delete(pairKey(...team))
      recordGame(history, game, roundOffset + rounds.length)
    }
  }
  return rounds
}

/** Plan full rounds, allowing adjacent internal rotations to share a round. */
export function buildAmericanoCycle(players: Player[], courts: number, rounds: Round[], seed: number): AmericanoRoundPlan[] {
  const count = players.length
  if (count < 4) throw new Error('Americano requires at least four players.')
  if (!Number.isInteger(courts) || courts < 1) throw new Error('Americano requires at least one whole court.')
  if (new Set(players.map((player) => player.id)).size !== count) throw new Error('Americano player IDs must be unique.')
  const courtCount = Math.min(courts, Math.floor(count / 4))
  const gamesPerCycle = Math.ceil(count * (count - 1) / 4)
  const cycles = courtCount / gcd(courtCount, gamesPerCycle)
  const history = readHistory(players, rounds)
  const random = randomGenerator(seed)
  let exactOpposition = Boolean(buildBalancedDesign(count))
  let packed: Game[][] | null = null
  let bestCost = [Infinity, Infinity, Infinity, Infinity]
  const complete = isFullAmericanoCyclePossible(count)
  // Without a fixed opposition design there is nothing to preserve by costly
  // game packing. Construct the full partnership rounds directly instead.
  const packingAttempts = complete && !exactOpposition ? 0 :
    gamesPerCycle * cycles > 600 ? 1 : complete ? 8 : count <= 11 ? 16 : 4
  for (let attempt = 0; attempt < packingAttempts && (!complete || !packed); attempt += 1) {
    const plannedHistory = readHistory(players, rounds)
    const games: Game[] = []
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const design = selectCycle(count, plannedHistory, random)
      games.push(...design.flat())
      for (const game of design.flat()) recordGame(plannedHistory, game, rounds.length + cycle + 1)
    }
    const preferences = games.map((game) => [
      history.games.get(gameKey(game))?.count ?? 0,
      history.games.get(gameKey(game))?.lastRound ?? 0,
      game.filter((team) => history.lastPartners.has(pairKey(...team))).length,
    ])
    const candidate = packAmericanoGames(games, count, courtCount, history.appearances, history.lastPlayed,
      Math.floor(random() * 4294967296), rounds.length, preferences,
      isFullAmericanoCyclePossible(count) ? gamesPerCycle : undefined)
    if (candidate) {
      const appearances = [...history.appearances]
      const opponents = new Map<string, number>()
      const seenGames = new Map([...history.games].map(([key, value]) => [key, value.count]))
      let spread = 0, imbalance = 0, repeats = 0
      for (const round of candidate) {
        for (const game of round) {
          for (const player of game.flat()) appearances[player] += 1
          for (const key of opponentKeys(game)) increment(opponents, key)
          const key = gameKey(game)
          repeats += seenGames.get(key) ?? 0
          seenGames.set(key, (seenGames.get(key) ?? 0) + 1)
        }
        spread = Math.max(spread, Math.max(...appearances) - Math.min(...appearances))
        const total = appearances.reduce((sum, value) => sum + value, 0)
        imbalance += count * appearances.reduce((sum, value) => sum + value * value, 0) - total * total
      }
      const cost = [spread, [...opponents.values()].reduce((sum, value) => sum + value * value, 0), repeats, imbalance]
      if (compare(cost, bestCost) < 0) { packed = candidate; bestCost = cost }
      // Approximate fields cannot have perfectly equal opponent counts. Once
      // all prefixes are fair and opposition stays within one of its target,
      // more sampling brings little benefit to an interactive client.
      if (!complete && spread <= 1 && repeats === 0 && opponents.size === count * (count - 1) / 2 &&
        Math.max(...opponents.values()) <= cycles * 2 + 1 && Math.min(...opponents.values()) >= cycles * 2 - 1) break
    }
  }
  if (!packed && !complete) {
    packed = coverageFallback(count, courtCount, history, random, rounds.length)
  }
  if (!packed) {
    // Resize partnership matchings constructively before choosing opponents.
    // Unlike repeating source factors, this finishes each exact partnership
    // rotation before starting the next, even for large, nearly full fields.
    const teamRounds = buildAmericanoPartnerships(count, courtCount, Math.floor(random() * 4294967296))
    // Court packing can exhaust its budget for an unusually large design.
    // Keep exact partner rotations and full courts; opposition is then an
    // approximation rather than silently repeating unfinished rotations.
    exactOpposition = false
    const plannedHistory = readHistory(players, rounds)
    const opponents = new Map<string, number>()
    const games: Game[] = []
    const edgesPerCycle = count * (count - 1) / 2
    let edges = 0
    teamRounds.forEach((teams, index) => {
      const boundary = Math.min(teams.length, edgesPerCycle - edges % edgesPerCycle)
      for (const group of [teams.slice(0, boundary), teams.slice(boundary)]) {
        const matches = pairTeams(group, plannedHistory, opponents)!
        for (const game of matches) {
          games.push(game)
          recordGame(plannedHistory, game, rounds.length + index + 1)
          for (const key of opponentKeys(game)) increment(opponents, key)
        }
        edges += group.length
        if (edges % edgesPerCycle === 0) opponents.clear()
      }
    })
    packed = packAmericanoGames(games, count, courtCount, history.appearances, history.lastPlayed,
      Math.floor(random() * 4294967296), rounds.length, undefined, gamesPerCycle)
  }
  if (!packed) throw new Error('Unable to pack full Americano rounds.')
  const partners = new Map<string, number>(), opponents = new Map<string, number>()
  const pairCount = count * (count - 1) / 2
  for (const round of packed) {
    for (const game of round) {
      for (const team of game) increment(partners, pairKey(...team))
      for (const key of opponentKeys(game)) increment(opponents, key)
    }
    if (complete) {
      const minimum = partners.size < pairCount ? 0 : Math.min(...partners.values())
      if (Math.max(...partners.values()) - minimum > 1) throw new Error('Americano partnership rotations overlap.')
    }
  }
  if (partners.size !== count * (count - 1) / 2 || (complete && new Set(partners.values()).size !== 1)) {
    throw new Error('Packed Americano rounds lost partnership coverage.')
  }
  if (exactOpposition) {
    const repetitions = partners.values().next().value!
    if (opponents.size !== partners.size || [...opponents.values()].some((value) => value !== repetitions * 2)) {
      throw new Error('Packed Americano rounds lost opposition balance.')
    }
  }
  return packed.map((games) => {
    const active = new Set(games.flatMap((game) => game.flat()))
    if (games.length !== courtCount || active.size !== games.length * 4) throw new Error('Invalid Americano round.')
    return {
      matches: games.map(([a, b]) => ({
        teamAPlayerIds: a.map((index) => players[index].id) as [string, string],
        teamBPlayerIds: b.map((index) => players[index].id) as [string, string],
      })),
      byePlayerIds: players.filter((_, index) => !active.has(index)).map((player) => player.id),
    }
  })
}
