import type { Player, Round } from './types'

export interface AmericanoMatchPlan {
  teamAPlayerIds: [string, string]
  teamBPlayerIds: [string, string]
}

export interface AmericanoRoundPlan {
  matches: AmericanoMatchPlan[]
  byePlayerIds: string[]
}

type Team = [number, number]
type Game = [Team, Team]
type Cost = [number, number, number, number]
interface PreviousGame { count: number; lastRound: number }

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

function pairKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`
}

function gameKey([a, b]: Game): string {
  return [pairKey(...a), pairKey(...b)].sort().join('|')
}

function opponentKeys([a, b]: Game): string[] {
  return a.flatMap((first) => b.map((second) => pairKey(first, second)))
}

function compare(a: Cost, b: Cost): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]
}

function add(a: Cost, b: Cost): Cost {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]
}

// The circle construction partitions every edge of the partnership graph once.
// An odd field gets one rotating dummy; removing it gives one bye per factor.
function partnershipFactors(labels: number[]): Team[][] {
  const circle = [...labels]
  if (circle.length % 2) circle.push(-1)
  const factors: Team[][] = []
  for (let round = 0; round < circle.length - 1; round += 1) {
    const teams: Team[] = []
    for (let index = 0; index < circle.length / 2; index += 1) {
      const a = circle[index]
      const b = circle[circle.length - 1 - index]
      if (a !== -1 && b !== -1) teams.push([a, b])
    }
    factors.push(teams)
    circle.splice(1, 0, circle.pop()!)
  }
  return factors
}

// A cyclic whist design: each partnership occurs once, each opposition twice.
function eightPlayerWhist(labels: number[]): Game[][] {
  const starter: Game[] = [[[7, 0], [1, 3]], [[2, 6], [4, 5]]]
  return Array.from({ length: 7 }, (_, shift) => starter.map((game) => game.map((team) =>
    team.map((value) => labels[value === 7 ? 7 : (value + shift) % 7]) as Team,
  ) as Game))
}

/**
 * Plans a complete partnership cycle independently of scores and Player.seed.
 * Historical whole-game repeats take precedence over opponent balance. Search
 * is bounded: small fields enumerate at most 105 team matchings per factor;
 * large fields use greedy matching, with fewer relabelled candidate cycles.
 * If courts do not divide a factor, its final round has unused courts. Keeping
 * factors intact guarantees equal total appearances and byes for all players.
 */
export function buildAmericanoCycle(
  players: Player[],
  courts: number,
  history: Round[],
  seed: number,
): AmericanoRoundPlan[] {
  const count = players.length
  if (!isFullAmericanoCyclePossible(count)) {
    throw new Error('A full Americano cycle requires at least 4 players and a player count divisible by 4, or one greater.')
  }
  if (!Number.isInteger(courts) || courts < 1) throw new Error('Americano requires at least one whole court.')
  if (new Set(players.map((player) => player.id)).size !== count) throw new Error('Americano player IDs must be unique.')

  const indexes = new Map(players.map((player, index) => [player.id, index]))
  const previousGames = new Map<string, PreviousGame>()
  const previousOpponents = new Map<string, number>()
  history.forEach((round, roundIndex) => round.matches.forEach((match) => {
    const ids = [...match.teamAPlayerIds, ...match.teamBPlayerIds].map((id) => indexes.get(id))
    if (ids.some((id) => id === undefined)) return
    const game: Game = [[ids[0]!, ids[1]!], [ids[2]!, ids[3]!]]
    const key = gameKey(game)
    previousGames.set(key, { count: (previousGames.get(key)?.count ?? 0) + 1, lastRound: roundIndex + 1 })
    for (const key of opponentKeys(game)) previousOpponents.set(key, (previousOpponents.get(key) ?? 0) + 1)
  }))

  const random = randomGenerator(seed)
  const labels = players.map((_, index) => index)
  const attempts = count <= 9 ? 192 : count <= 16 ? 48 : count <= 32 ? 16 : 4
  const historicalOpponentCounts = [...previousOpponents.values()]
  const balancedEightPlayerHistory = previousOpponents.size === 0 ||
    (previousOpponents.size === 28 && historicalOpponentCounts.every((value) => value === historicalOpponentCounts[0]))
  const whistBound = 4 * historicalOpponentCounts.reduce((sum, value) => sum + value, 0) + 112
  let best: Game[][] = []
  let bestCost: Cost = [Infinity, Infinity, Infinity, Infinity]

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const relabelled = shuffle(labels, random)
    const opponents = new Map(previousOpponents)
    const gameCost = (game: Game): Cost => {
      const previous = previousGames.get(gameKey(game))
      return [previous ? 1 : 0, previous?.count ?? 0, previous?.lastRound ?? 0,
        opponentKeys(game).reduce((total, key) => total + 2 * (opponents.get(key) ?? 0) + 1, 0)]
    }
    const record = (game: Game) => {
      for (const key of opponentKeys(game)) opponents.set(key, (opponents.get(key) ?? 0) + 1)
    }
    let candidate: Game[][]
    let cost: Cost = [0, 0, 0, 0]

    if (count === 8 && attempt < attempts * 3 / 4) {
      candidate = eightPlayerWhist(relabelled)
      for (const games of candidate) for (const game of games) {
        cost = add(cost, gameCost(game))
        record(game)
      }
    } else {
      candidate = shuffle(partnershipFactors(relabelled), random).map((factor) => {
        const teams = shuffle(factor, random)
        const edges = teams.map((a) => teams.map((b) => gameCost([a, b])))
        let chosen: Game[] = []
        let chosenCost: Cost = [Infinity, Infinity, Infinity, Infinity]
        if (teams.length <= 8) {
          // Eight teams have only 7*5*3=105 matchings; never enumerate beyond it.
          const visit = (remaining: number[], games: Game[], current: Cost) => {
            if (!remaining.length) {
              if (compare(current, chosenCost) < 0) { chosen = games; chosenCost = current }
              return
            }
            const first = remaining[0]
            for (let index = 1; index < remaining.length; index += 1) {
              const other = remaining[index]
              visit(remaining.filter((_, position) => position !== 0 && position !== index),
                [...games, [teams[first], teams[other]]], add(current, edges[first][other]))
            }
          }
          visit(teams.map((_, index) => index), [], [0, 0, 0, 0])
        } else {
          const remaining = teams.map((_, index) => index)
          chosenCost = [0, 0, 0, 0]
          while (remaining.length) {
            const first = remaining.shift()!
            let bestIndex = 0
            for (let index = 1; index < remaining.length; index += 1) {
              if (compare(edges[first][remaining[index]], edges[first][remaining[bestIndex]]) < 0) bestIndex = index
            }
            const other = remaining.splice(bestIndex, 1)[0]
            chosen.push([teams[first], teams[other]])
            chosenCost = add(chosenCost, edges[first][other])
          }
        }
        cost = add(cost, chosenCost)
        chosen.forEach(record)
        return chosen
      })
    }

    if (compare(cost, bestCost) < 0) { best = candidate; bestCost = cost }
    // With balanced history, whist reaches the absolute opposition balance bound.
    if (count === 8 && balancedEightPlayerHistory && cost[0] === 0 && cost[3] === whistBound) break
  }

  const lastPlayed = (games: Game[]) => Math.max(0, ...games.map((game) => previousGames.get(gameKey(game))?.lastRound ?? 0))
  const repeatFrequency = (games: Game[]) => games.reduce((total, game) => total + (previousGames.get(gameKey(game))?.count ?? 0), 0)
  const lastPartners = new Set(history.at(-1)?.matches.flatMap((match) => [match.teamAPlayerIds, match.teamBPlayerIds]
    .map((team) => team.map((id) => indexes.get(id)))
    .filter((team) => team.every((id) => id !== undefined))
    .map((team) => pairKey(team[0]!, team[1]!))) ?? [])
  const partnerOverlap = (games: Game[]) => games.reduce((total, game) =>
    total + game.filter((team) => lastPartners.has(pairKey(...team))).length, 0)
  // When repeats are unavoidable (notably four players), play the oldest first.
  const ordered = shuffle(best, random).sort((a, b) => repeatFrequency(a) - repeatFrequency(b) ||
    lastPlayed(a) - lastPlayed(b) || partnerOverlap(a) - partnerOverlap(b))
  return ordered.flatMap((games) => {
    const matches = shuffle(games, random)
    const rounds: AmericanoRoundPlan[] = []
    for (let start = 0; start < matches.length; start += courts) {
      const group = matches.slice(start, start + courts)
      const active = new Set(group.flatMap((game) => game.flat()))
      rounds.push({
        matches: group.map(([a, b]) => ({
          teamAPlayerIds: a.map((index) => players[index].id) as [string, string],
          teamBPlayerIds: b.map((index) => players[index].id) as [string, string],
        })),
        byePlayerIds: players.filter((_, index) => !active.has(index)).map((player) => player.id),
      })
    }
    return rounds
  })
}
