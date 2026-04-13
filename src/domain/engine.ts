import type { Match, MexicanoVariant, Player, Round, Standing, Tournament, TournamentMode } from './types'

export const POINTS_PER_MATCH = 21

interface MatchBlueprint {
  teamA: [Player, Player]
  teamB: [Player, Player]
}

interface PlayerStats {
  played: number
  wins: number
  losses: number
  byes: number
  totalPoints: number
  pointsAgainst: number
  differential: number
}

interface MatchHistory {
  partners: Map<string, number>
  opponents: Map<string, number>
}

interface CreateTournamentInput {
  name: string
  mode: TournamentMode
  courts: number
  playerNames: string[]
  mexicanoVariant?: MexicanoVariant
  minRoundsBeforeReseeding?: number
}

interface UpdateResult {
  tournament: Tournament
  droppedFutureRounds: number
}

export function createTournament({
  name,
  mode,
  courts,
  playerNames,
  mexicanoVariant = 'global-standings',
  minRoundsBeforeReseeding = 0,
}: CreateTournamentInput): Tournament {
  const trimmedNames = playerNames.map((playerName) => playerName.trim()).filter(Boolean)
  const players = trimmedNames.map((playerName, index) => ({
    id: createId(`player-${index + 1}`),
    name: playerName,
    seed: index + 1,
  }))
  const now = new Date().toISOString()
  const seed = createNumericSeed(`${name}-${players.map((player) => player.name).join('|')}-${now}`)

  const tournament: Tournament = {
    id: createId('tournament'),
    name: name.trim() || `${mode === 'americano' ? 'Americano' : 'Mexicano'} Club Night`,
    mode,
    courts,
    players,
    rounds: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    seed,
    mexicanoVariant,
    minRoundsBeforeReseeding,
  }

  return appendNextRound(tournament)
}

export function appendNextRound(tournament: Tournament): Tournament {
  if (tournament.status !== 'active') {
    return tournament
  }

  const lastRound = tournament.rounds.at(-1)

  if (lastRound && !isRoundComplete(lastRound)) {
    return tournament
  }

  const nextRound =
    tournament.mode === 'americano'
      ? generateAmericanoRound(tournament)
      : generateMexicanoRound(tournament)

  if (!nextRound) {
    return tournament
  }

  return {
    ...tournament,
    rounds: [...tournament.rounds, nextRound],
    updatedAt: new Date().toISOString(),
  }
}

export function updateMatchScore(
  tournament: Tournament,
  roundId: string,
  matchId: string,
  scoreA: number,
): UpdateResult {
  const boundedScore = Math.max(0, Math.min(POINTS_PER_MATCH, scoreA))
  const roundIndex = tournament.rounds.findIndex((round) => round.id === roundId)

  if (roundIndex < 0) {
    return { tournament, droppedFutureRounds: 0 }
  }

  const nextRounds = tournament.rounds.map((round) => {
    if (round.id !== roundId) {
      return round
    }

    return {
      ...round,
      matches: round.matches.map((match) => {
        if (match.id !== matchId) {
          return match
        }

        return {
          ...match,
          scoreA: boundedScore,
          scoreB: POINTS_PER_MATCH - boundedScore,
          completedAt: new Date().toISOString(),
        }
      }),
    }
  })

  if (tournament.mode !== 'mexicano') {
    return {
      tournament: {
        ...tournament,
        rounds: nextRounds,
        updatedAt: new Date().toISOString(),
      },
      droppedFutureRounds: 0,
    }
  }

  const droppedFutureRounds = Math.max(0, nextRounds.length - roundIndex - 1)

  return {
    tournament: {
      ...tournament,
      rounds: nextRounds.slice(0, roundIndex + 1),
      updatedAt: new Date().toISOString(),
    },
    droppedFutureRounds,
  }
}

export function finishTournament(tournament: Tournament): Tournament {
  return {
    ...tournament,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  }
}

export function reopenTournament(tournament: Tournament): Tournament {
  if (tournament.status !== 'completed') {
    return tournament
  }

  return {
    ...tournament,
    status: 'active',
    updatedAt: new Date().toISOString(),
  }
}

export interface HeadToHeadGrid {
  /** Same order as `tournament.players`. */
  players: Player[]
  /**
   * `wins[row][col]` counts how many times the row player beat the column player
   * when they met as opponents (opposite teams in a doubles match).
   */
  wins: number[][]
}

export function computeHeadToHead(tournament: Tournament): HeadToHeadGrid {
  const players = tournament.players
  const n = players.length
  const indexById = new Map(players.map((player, index) => [player.id, index]))
  const wins: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0))

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.scoreA === null || match.scoreB === null) {
        continue
      }

      if (match.scoreA === match.scoreB) {
        continue
      }

      const teamAWins = match.scoreA > match.scoreB

      for (const a of match.teamAPlayerIds) {
        const ia = indexById.get(a)

        if (ia === undefined) {
          continue
        }

        for (const b of match.teamBPlayerIds) {
          const ib = indexById.get(b)

          if (ib === undefined) {
            continue
          }

          if (teamAWins) {
            wins[ia][ib] += 1
          } else {
            wins[ib][ia] += 1
          }
        }
      }
    }
  }

  return { players, wins }
}

export function computeStandings(tournament: Tournament): Standing[] {
  const statsByPlayer = new Map<string, PlayerStats>()

  for (const player of tournament.players) {
    statsByPlayer.set(player.id, {
      played: 0,
      wins: 0,
      losses: 0,
      byes: 0,
      totalPoints: 0,
      pointsAgainst: 0,
      differential: 0,
    })
  }

  for (const round of tournament.rounds) {
    for (const playerId of round.byePlayerIds) {
      const stats = statsByPlayer.get(playerId)

      if (stats) {
        stats.byes += 1
      }
    }

    for (const match of round.matches) {
      if (match.scoreA === null || match.scoreB === null) {
        continue
      }

      applyScore(statsByPlayer, match.teamAPlayerIds, match.scoreA, match.scoreB)
      applyScore(statsByPlayer, match.teamBPlayerIds, match.scoreB, match.scoreA)
    }
  }

  // Precompute a stable randomised order for tie-breaking (avoids always favouring
  // early-registered players when all other criteria are equal).
  const tieBreakOrder = new Map(
    seededShuffle(tournament.players, tournament.seed).map((player, index) => [player.id, index]),
  )

  return tournament.players
    .map((player) => {
      const stats = statsByPlayer.get(player.id)

      if (!stats) {
        throw new Error(`Missing stats for player ${player.id}`)
      }

      return {
        playerId: player.id,
        name: player.name,
        rank: 0,
        played: stats.played,
        wins: stats.wins,
        losses: stats.losses,
        byes: stats.byes,
        totalPoints: stats.totalPoints,
        pointsAgainst: stats.pointsAgainst,
        differential: stats.differential,
        seed: player.seed,
      }
    })
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins
      }

      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints
      }

      if (right.differential !== left.differential) {
        return right.differential - left.differential
      }

      if (right.played !== left.played) {
        return right.played - left.played
      }

      return (tieBreakOrder.get(left.playerId) ?? 0) - (tieBreakOrder.get(right.playerId) ?? 0)
    })
    .map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }))
}

export function isRoundComplete(round: Round) {
  return round.matches.every((match) => match.scoreA !== null && match.scoreB !== null)
}

export function getLeaderLabel(tournament: Tournament) {
  const leader = computeStandings(tournament)[0]
  return leader ? `${leader.name} · ${leader.totalPoints} pts` : 'No results yet'
}

export function getRoundLabel(round: Round) {
  return `Round ${round.number}`
}

function applyScore(
  statsByPlayer: Map<string, PlayerStats>,
  playerIds: [string, string],
  pointsFor: number,
  pointsAgainst: number,
) {
  for (const playerId of playerIds) {
    const stats = statsByPlayer.get(playerId)

    if (!stats) {
      continue
    }

    stats.played += 1
    stats.totalPoints += pointsFor
    stats.pointsAgainst += pointsAgainst
    stats.differential += pointsFor - pointsAgainst

    if (pointsFor > pointsAgainst) {
      stats.wins += 1
    } else if (pointsFor < pointsAgainst) {
      stats.losses += 1
    }
  }
}

function generateAmericanoRound(tournament: Tournament) {
  const roundNumber = tournament.rounds.length + 1
  const activeSlots = tournament.courts * 4
  const byePlayerIds = selectByePlayerIds(tournament, activeSlots, false)
  const activePlayers = tournament.players.filter((player) => !byePlayerIds.includes(player.id))

  const blueprints =
    tournament.rounds.length === 0
      ? buildDeterministicFirstRound(activePlayers)
      : buildAmericanoBlueprints(activePlayers, tournament.rounds)

  return createRound(
    roundNumber,
    byePlayerIds,
    blueprints,
    tournament.rounds.length === 0 ? 'deterministic' : 'standings',
  )
}

function generateMexicanoRound(tournament: Tournament) {
  const roundNumber = tournament.rounds.length + 1
  const activeSlots = tournament.courts * 4
  const byePlayerIds = selectByePlayerIds(tournament, activeSlots, true)
  const history = buildMatchHistory(tournament.rounds)

  let activePlayers: Player[]
  let source: Round['source']
  let useFindBestPairingWithinGroups = false

  if (tournament.rounds.length === 0) {
    activePlayers = seededShuffle(tournament.players, tournament.seed).filter(
      (player) => !byePlayerIds.includes(player.id),
    )
    source = 'randomized'
  } else {
    const standings = computeStandings(tournament)
    const playerById = new Map(tournament.players.map((player) => [player.id, player]))
    const variant = tournament.mexicanoVariant ?? 'global-standings'

    if (variant === 'court-locked') {
      activePlayers = buildCourtLockedOrder(tournament, standings, byePlayerIds, playerById)
      source = 'court-locked'
      useFindBestPairingWithinGroups = true
    } else if (variant === 'promotion-relegation') {
      activePlayers = buildPromotionRelegationOrder(tournament, standings, byePlayerIds, playerById)
      source = 'promotion-relegation'
      useFindBestPairingWithinGroups = true
    } else {
      // global-standings
      const minRounds = tournament.minRoundsBeforeReseeding ?? 0
      const useSeededOrder = tournament.rounds.length <= minRounds

      if (useSeededOrder) {
        activePlayers = [...tournament.players]
          .filter((player) => !byePlayerIds.includes(player.id))
          .sort((a, b) => a.seed - b.seed)
        activePlayers = smoothMexicanoQuartets(activePlayers, history)
        source = 'seeded'
      } else {
        activePlayers = standings
          .map((standing) => playerById.get(standing.playerId))
          .filter((player): player is Player => player !== undefined)
          .filter((player) => !byePlayerIds.includes(player.id))

        activePlayers = smoothMexicanoQuartets(activePlayers, history)
        source = 'standings'
      }
    }
  }

  const blueprints: MatchBlueprint[] = []

  for (let index = 0; index < activePlayers.length; index += 4) {
    const quartet = activePlayers.slice(index, index + 4)

    if (quartet.length < 4) {
      break
    }

    if (useFindBestPairingWithinGroups) {
      blueprints.push(findBestPairing(quartet, history).match)
    } else {
      blueprints.push({
        teamA: [quartet[0], quartet[3]],
        teamB: [quartet[1], quartet[2]],
      })
    }
  }

  return createRound(roundNumber, byePlayerIds, blueprints, source)
}

function createRound(
  roundNumber: number,
  byePlayerIds: string[],
  blueprints: MatchBlueprint[],
  source: Round['source'],
): Round {
  return {
    id: createId(`round-${roundNumber}`),
    number: roundNumber,
    byePlayerIds,
    createdAt: new Date().toISOString(),
    source,
    matches: blueprints.map((blueprint, index) => createMatch(index + 1, blueprint)),
  }
}

function createMatch(court: number, blueprint: MatchBlueprint): Match {
  return {
    id: createId(`match-${court}`),
    court,
    teamAPlayerIds: [blueprint.teamA[0].id, blueprint.teamA[1].id],
    teamBPlayerIds: [blueprint.teamB[0].id, blueprint.teamB[1].id],
    scoreA: null,
    scoreB: null,
    completedAt: null,
  }
}

function buildDeterministicFirstRound(players: Player[]) {
  const sortedPlayers = [...players].sort((left, right) => left.seed - right.seed)
  const blueprints: MatchBlueprint[] = []

  for (let index = 0; index < sortedPlayers.length; index += 4) {
    const quartet = sortedPlayers.slice(index, index + 4)

    if (quartet.length < 4) {
      break
    }

    blueprints.push({
      teamA: [quartet[0], quartet[3]],
      teamB: [quartet[1], quartet[2]],
    })
  }

  return blueprints
}

function buildAmericanoBlueprints(players: Player[], rounds: Round[]) {
  const history = buildMatchHistory(rounds)
  const sortedPlayers = [...players].sort((left, right) => left.seed - right.seed)

  const best = searchAmericanoMatches(sortedPlayers, history)

  return best ?? buildDeterministicFirstRound(sortedPlayers)
}

function searchAmericanoMatches(players: Player[], history: MatchHistory): MatchBlueprint[] | null {
  if (players.length === 0) {
    return []
  }

  const [anchor, ...others] = players
  let bestCost = Number.POSITIVE_INFINITY
  let bestBlueprints: MatchBlueprint[] | null = null
  const candidates = combinations(others, 3)
    .map((group) => [anchor, ...group])
    .map((group) => {
      const quartet = [...group].sort((left, right) => left.seed - right.seed)
      const blueprint = findBestPairing(quartet, history)
      return {
        blueprint,
        playerIds: new Set(quartet.map((player) => player.id)),
        signature: quartet.map((player) => player.seed).join('-'),
      }
    })
    .sort((left, right) => {
      if (left.blueprint.cost !== right.blueprint.cost) {
        return left.blueprint.cost - right.blueprint.cost
      }

      return left.signature.localeCompare(right.signature)
    })
    .slice(0, 8)

  for (const candidate of candidates) {
    const remainingPlayers = players.filter((player) => !candidate.playerIds.has(player.id))
    const remainder = searchAmericanoMatches(remainingPlayers, history)

    if (!remainder) {
      continue
    }

    const totalCost = candidate.blueprint.cost + scoreBlueprints(remainder, history)

    if (totalCost < bestCost) {
      bestCost = totalCost
      bestBlueprints = [candidate.blueprint.match, ...remainder]
    }
  }

  return bestBlueprints
}

function findBestPairing(players: Player[], history: MatchHistory) {
  const pairings: Array<[[Player, Player], [Player, Player]]> = [
    [
      [players[0], players[1]],
      [players[2], players[3]],
    ],
    [
      [players[0], players[2]],
      [players[1], players[3]],
    ],
    [
      [players[0], players[3]],
      [players[1], players[2]],
    ],
  ]

  let best: { cost: number; match: MatchBlueprint } | null = null

  for (const [teamA, teamB] of pairings) {
    const match = { teamA, teamB } satisfies MatchBlueprint
    const cost = scoreBlueprint(match, history)

    if (!best || cost < best.cost) {
      best = { cost, match }
    }
  }

  if (!best) {
    throw new Error('No pairing found')
  }

  return best
}

function scoreBlueprint(blueprint: MatchBlueprint, history: MatchHistory) {
  const [a1, a2] = blueprint.teamA
  const [b1, b2] = blueprint.teamB
  const partnerRepeats =
    getMatchHistoryCount(history.partners, a1.id, a2.id) + getMatchHistoryCount(history.partners, b1.id, b2.id)
  const opponentRepeats =
    getMatchHistoryCount(history.opponents, a1.id, b1.id) +
    getMatchHistoryCount(history.opponents, a1.id, b2.id) +
    getMatchHistoryCount(history.opponents, a2.id, b1.id) +
    getMatchHistoryCount(history.opponents, a2.id, b2.id)
  const spread = Math.abs(a1.seed + a2.seed - (b1.seed + b2.seed))

  return partnerRepeats * 100 + opponentRepeats * 8 + spread
}

function scoreBlueprints(blueprints: MatchBlueprint[], history: MatchHistory) {
  return blueprints.reduce((total, blueprint) => total + scoreBlueprint(blueprint, history), 0)
}

function smoothMexicanoQuartets(players: Player[], history: MatchHistory) {
  const nextOrder = [...players]

  for (let index = 0; index < nextOrder.length - 4; index += 4) {
    const currentCost = getQuartetCost(nextOrder.slice(index, index + 4), history)
    let bestCost = currentCost
    let bestSwapIndex = -1

    for (let candidateIndex = index + 4; candidateIndex < Math.min(index + 5, nextOrder.length); candidateIndex += 1) {
      const swapped = [...nextOrder]
      const previousPlayer = swapped[index + 3]
      swapped[index + 3] = swapped[candidateIndex]
      swapped[candidateIndex] = previousPlayer

      const swappedCost =
        getQuartetCost(swapped.slice(index, index + 4), history) +
        getQuartetCost(swapped.slice(index + 4, index + 8), history)

      if (swappedCost < bestCost) {
        bestCost = swappedCost
        bestSwapIndex = candidateIndex
      }
    }

    if (bestSwapIndex > -1) {
      const playerToMove = nextOrder[index + 3]
      nextOrder[index + 3] = nextOrder[bestSwapIndex]
      nextOrder[bestSwapIndex] = playerToMove
    }
  }

  return nextOrder
}

function getQuartetCost(quartet: Player[], history: MatchHistory) {
  if (quartet.length < 4) {
    return 0
  }

  return scoreBlueprint(
    {
      teamA: [quartet[0], quartet[3]],
      teamB: [quartet[1], quartet[2]],
    },
    history,
  )
}

function buildCourtLockedOrder(
  tournament: Tournament,
  standings: Standing[],
  byePlayerIds: string[],
  playerById: Map<string, Player>,
): Player[] {
  // Determine each player's home court from the very first round.
  // Players who had a bye in round 1 are assigned by seed position.
  const homeCourtByPlayer = new Map<string, number>()
  const firstRound = tournament.rounds[0]

  for (const match of firstRound.matches) {
    for (const playerId of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
      homeCourtByPlayer.set(playerId, match.court)
    }
  }

  for (const player of tournament.players) {
    if (!homeCourtByPlayer.has(player.id)) {
      homeCourtByPlayer.set(player.id, Math.floor((player.seed - 1) / 4) + 1)
    }
  }

  const standingsRankById = new Map(standings.map((s, i) => [s.playerId, i]))

  return standings
    .map((standing) => playerById.get(standing.playerId))
    .filter((player): player is Player => player !== undefined)
    .filter((player) => !byePlayerIds.includes(player.id))
    .sort((a, b) => {
      const courtA = homeCourtByPlayer.get(a.id) ?? 999
      const courtB = homeCourtByPlayer.get(b.id) ?? 999

      if (courtA !== courtB) {
        return courtA - courtB
      }

      return (standingsRankById.get(a.id) ?? 0) - (standingsRankById.get(b.id) ?? 0)
    })
}

function buildPromotionRelegationOrder(
  tournament: Tournament,
  standings: Standing[],
  byePlayerIds: string[],
  playerById: Map<string, Player>,
): Player[] {
  // Determine each active player's current court from the most recent round.
  // If a player was on a bye last round, walk back to find their last active court.
  const courtByPlayer = new Map<string, number>()

  for (let roundIndex = tournament.rounds.length - 1; roundIndex >= 0; roundIndex -= 1) {
    const round = tournament.rounds[roundIndex]

    for (const match of round.matches) {
      for (const playerId of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
        if (!courtByPlayer.has(playerId)) {
          courtByPlayer.set(playerId, match.court)
        }
      }
    }
  }

  // Fallback for players who were never active (all byes): assign by seed.
  for (const player of tournament.players) {
    if (!courtByPlayer.has(player.id)) {
      courtByPlayer.set(player.id, Math.floor((player.seed - 1) / 4) + 1)
    }
  }

  const standingsRankById = new Map(standings.map((s, i) => [s.playerId, i]))

  const activePlayers = standings
    .map((standing) => playerById.get(standing.playerId))
    .filter((player): player is Player => player !== undefined)
    .filter((player) => !byePlayerIds.includes(player.id))

  // Build court groups from last-active-court assignments.
  const courtGroups: Player[][] = Array.from({ length: tournament.courts }, () => [])

  for (const player of activePlayers) {
    const court = Math.min(courtByPlayer.get(player.id) ?? 1, tournament.courts) - 1
    courtGroups[court].push(player)
  }

  // Sort each group by standings (best rank first).
  for (const group of courtGroups) {
    group.sort((a, b) => (standingsRankById.get(a.id) ?? 0) - (standingsRankById.get(b.id) ?? 0))
  }

  // Apply promotion / relegation at each court boundary:
  // - The bottom player of the upper court is relegated to the lower court.
  // - The top player of the lower court is promoted to the upper court.
  for (let i = 0; i < courtGroups.length - 1; i += 1) {
    const upperCourt = courtGroups[i]
    const lowerCourt = courtGroups[i + 1]

    if (upperCourt.length > 0 && lowerCourt.length > 0) {
      const relegated = upperCourt.pop()!
      const promoted = lowerCourt.shift()!
      upperCourt.push(promoted)
      lowerCourt.unshift(relegated)
    }
  }

  // Re-sort within each group by standings after swaps, then flatten.
  for (const group of courtGroups) {
    group.sort((a, b) => (standingsRankById.get(a.id) ?? 0) - (standingsRankById.get(b.id) ?? 0))
  }

  return courtGroups.flat()
}

function selectByePlayerIds(tournament: Tournament, activeSlots: number, randomizeOpeningRound: boolean) {
  const benchCount = Math.max(0, tournament.players.length - activeSlots)

  if (benchCount === 0) {
    return []
  }

  if (randomizeOpeningRound && tournament.rounds.length === 0) {
    return seededShuffle(tournament.players, tournament.seed)
      .slice(activeSlots)
      .map((player) => player.id)
  }

  const byeCounts = new Map<string, { byes: number; lastRound: number }>()

  for (const player of tournament.players) {
    byeCounts.set(player.id, {
      byes: 0,
      lastRound: -1,
    })
  }

  tournament.rounds.forEach((round, index) => {
    for (const playerId of round.byePlayerIds) {
      const current = byeCounts.get(playerId)

      if (current) {
        current.byes += 1
        current.lastRound = index
      }
    }
  })

  return [...tournament.players]
    .sort((left, right) => {
      const leftCounts = byeCounts.get(left.id)
      const rightCounts = byeCounts.get(right.id)

      if (!leftCounts || !rightCounts) {
        return left.seed - right.seed
      }

      if (leftCounts.byes !== rightCounts.byes) {
        return leftCounts.byes - rightCounts.byes
      }

      if (leftCounts.lastRound !== rightCounts.lastRound) {
        return leftCounts.lastRound - rightCounts.lastRound
      }

      return left.seed - right.seed
    })
    .slice(0, benchCount)
    .map((player) => player.id)
}

function buildMatchHistory(rounds: Round[]): MatchHistory {
  const partners = new Map<string, number>()
  const opponents = new Map<string, number>()

  for (const round of rounds) {
    for (const match of round.matches) {
      incrementPairCount(partners, match.teamAPlayerIds[0], match.teamAPlayerIds[1])
      incrementPairCount(partners, match.teamBPlayerIds[0], match.teamBPlayerIds[1])
      incrementPairCount(opponents, match.teamAPlayerIds[0], match.teamBPlayerIds[0])
      incrementPairCount(opponents, match.teamAPlayerIds[0], match.teamBPlayerIds[1])
      incrementPairCount(opponents, match.teamAPlayerIds[1], match.teamBPlayerIds[0])
      incrementPairCount(opponents, match.teamAPlayerIds[1], match.teamBPlayerIds[1])
    }
  }

  return { partners, opponents }
}

function incrementPairCount(map: Map<string, number>, firstPlayerId: string, secondPlayerId: string) {
  const key = createPairKey(firstPlayerId, secondPlayerId)
  map.set(key, (map.get(key) ?? 0) + 1)
}

function getMatchHistoryCount(map: Map<string, number>, firstPlayerId: string, secondPlayerId: string) {
  return map.get(createPairKey(firstPlayerId, secondPlayerId)) ?? 0
}

function createPairKey(firstPlayerId: string, secondPlayerId: string) {
  return [firstPlayerId, secondPlayerId].sort().join('::')
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) {
    return [[]]
  }

  if (items.length < size) {
    return []
  }

  const [head, ...tail] = items
  const withHead = combinations(tail, size - 1).map((combination) => [head, ...combination])
  const withoutHead = combinations(tail, size)

  return [...withHead, ...withoutHead]
}

function seededShuffle<T>(items: T[], seed: number) {
  const nextItems = [...items]
  let state = seed

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    state = mulberry32(state)
    const swapIndex = Math.floor(state * (index + 1))
    const previousItem = nextItems[index]
    nextItems[index] = nextItems[swapIndex]
    nextItems[swapIndex] = previousItem
  }

  return nextItems
}

function mulberry32(seed: number) {
  let current = seed + 0x6d2b79f5
  current = Math.imul(current ^ (current >>> 15), current | 1)
  current ^= current + Math.imul(current ^ (current >>> 7), current | 61)
  return ((current ^ (current >>> 14)) >>> 0) / 4294967296
}

function createNumericSeed(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`
}
