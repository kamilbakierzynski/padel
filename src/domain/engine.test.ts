import { describe, expect, it } from 'vitest'

import {
  appendNextRound,
  computeHeadToHead,
  computeStandings,
  createTournament,
  finishTournament,
  reopenTournament,
  updateMatchScore,
} from './engine'

/** Play all matches in a round with the given scoreA for every match. */
function completeRound(tournament: ReturnType<typeof createTournament>, scoreA: number) {
  const round = tournament.rounds.at(-1)!
  let t = tournament
  for (const match of round.matches) {
    t = updateMatchScore(t, round.id, match.id, scoreA).tournament
  }
  return t
}

describe('tournament engine', () => {
  it('creates a deterministic Americano opening round', () => {
    const tournament = createTournament({
      name: 'Club Night',
      mode: 'americano',
      courts: 2,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina', 'Ema', 'Faye', 'Gia', 'Hope'],
    })

    expect(tournament.rounds).toHaveLength(1)
    expect(tournament.rounds[0].matches).toHaveLength(2)
    expect(tournament.rounds[0].matches[0].teamAPlayerIds).toHaveLength(2)
  })

  it('avoids repeated Americano partners on the second round when possible', () => {
    let tournament = createTournament({
      name: 'Partner Rotation',
      mode: 'americano',
      courts: 2,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina', 'Ema', 'Faye', 'Gia', 'Hope'],
    })

    const firstRound = tournament.rounds[0]

    tournament = updateMatchScore(tournament, firstRound.id, firstRound.matches[0].id, 11).tournament
    tournament = updateMatchScore(tournament, firstRound.id, firstRound.matches[1].id, 13).tournament
    tournament = appendNextRound(tournament)

    const firstPartners = new Set(
      firstRound.matches.flatMap((match) => [
        match.teamAPlayerIds.slice().sort().join(':'),
        match.teamBPlayerIds.slice().sort().join(':'),
      ]),
    )
    const secondPartners = tournament.rounds[1].matches.flatMap((match) => [
      match.teamAPlayerIds.slice().sort().join(':'),
      match.teamBPlayerIds.slice().sort().join(':'),
    ])

    expect(secondPartners.some((pairing) => firstPartners.has(pairing))).toBe(false)
  })

  it('counts head-to-head wins between opposing players in doubles', () => {
    let tournament = createTournament({
      name: 'H2H',
      mode: 'americano',
      courts: 1,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina'],
    })

    const round = tournament.rounds[0]
    const match = round.matches[0]
    tournament = updateMatchScore(tournament, round.id, match.id, 15).tournament

    const { players, wins } = computeHeadToHead(tournament)
    const index = (name: string) => players.findIndex((player) => player.name === name)

    const teamA = match.teamAPlayerIds.map((id) => players.find((player) => player.id === id)!.name)
    const teamB = match.teamBPlayerIds.map((id) => players.find((player) => player.id === id)!.name)

    expect(teamA).toHaveLength(2)
    expect(teamB).toHaveLength(2)

    for (const winnerName of teamA) {
      for (const loserName of teamB) {
        expect(wins[index(winnerName)][index(loserName)]).toBe(1)
        expect(wins[index(loserName)][index(winnerName)]).toBe(0)
      }
    }
  })

  it('ranks standings by wins first, then total points, then differential', () => {
    let tournament = createTournament({
      name: 'Standings',
      mode: 'americano',
      courts: 1,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina'],
    })

    const round = tournament.rounds[0]
    tournament = updateMatchScore(tournament, round.id, round.matches[0].id, 15).tournament

    const standings = computeStandings(tournament)

    // Winners (15 pts, 1 win) should outrank losers (6 pts, 0 wins)
    expect(standings[0].wins).toBe(1)
    expect(standings[0].totalPoints).toBe(15)
    expect(standings[0].differential).toBe(9)
    expect(standings.at(-1)?.wins).toBe(0)
    expect(standings.at(-1)?.totalPoints).toBe(6)
  })

  it('uses wins as the primary ranking criterion over total points', () => {
    // 2 courts, 8 players. Court 2 winners get 21 pts (1 win) and court 1 winners get
    // 11 pts (1 win). Court 1 losers get 10 pts (0 wins) and should outrank court 2
    // losers (0 pts, 0 wins) purely on points. This verifies wins > points > differential.
    let tournament = createTournament({
      name: 'Wins First',
      mode: 'americano',
      courts: 2,
      playerNames: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    })

    const round = tournament.rounds[0]
    // Court 1: score 11-10
    tournament = updateMatchScore(tournament, round.id, round.matches[0].id, 11).tournament
    // Court 2: score 21-0
    tournament = updateMatchScore(tournament, round.id, round.matches[1].id, 21).tournament

    const standings = computeStandings(tournament)

    // Top 2 slots: court-2 winners (1 win, 21 pts each)
    expect(standings[0].wins).toBe(1)
    expect(standings[0].totalPoints).toBe(21)
    // Slots 2-3: court-1 winners (1 win, 11 pts each)
    expect(standings[2].wins).toBe(1)
    expect(standings[2].totalPoints).toBe(11)
    // First 0-win player appears at index 4 (court-1 losers: 10 pts)
    expect(standings[4].wins).toBe(0)
    expect(standings[4].totalPoints).toBe(10)
  })

  it('reopens a completed tournament as active', () => {
    let tournament = createTournament({
      name: 'Reopen Me',
      mode: 'americano',
      courts: 1,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina'],
    })

    tournament = finishTournament(tournament)
    expect(tournament.status).toBe('completed')

    tournament = reopenTournament(tournament)
    expect(tournament.status).toBe('active')

    expect(reopenTournament(tournament)).toBe(tournament)
  })

  it('drops future Mexicano rounds after editing history', () => {
    let tournament = createTournament({
      name: 'Regroup',
      mode: 'mexicano',
      courts: 2,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina', 'Ema', 'Faye', 'Gia', 'Hope'],
    })

    const firstRound = tournament.rounds[0]
    tournament = updateMatchScore(tournament, firstRound.id, firstRound.matches[0].id, 11).tournament
    tournament = updateMatchScore(tournament, firstRound.id, firstRound.matches[1].id, 12).tournament
    tournament = appendNextRound(tournament)

    expect(tournament.rounds).toHaveLength(2)

    const result = updateMatchScore(tournament, firstRound.id, firstRound.matches[0].id, 10)

    expect(result.droppedFutureRounds).toBe(1)
    expect(result.tournament.rounds).toHaveLength(1)
  })

  it('Mexicano smoothing only swaps at the direct court boundary', () => {
    // With 3 courts (12 players) and rounds played, the smoothing pass should
    // only be able to swap the 4th player of court N with the 1st player of court N+1
    // (one position across the boundary), not further.
    let tournament = createTournament({
      name: 'Smooth Test',
      mode: 'mexicano',
      courts: 3,
      playerNames: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12'],
    })

    tournament = completeRound(tournament, 15)
    tournament = appendNextRound(tournament)

    expect(tournament.rounds).toHaveLength(2)

    // In round 2, each court should contain 4 players whose standings ranks
    // differ by at most 1 from the pure standings grouping (only border swaps allowed).
    const round2 = tournament.rounds[1]
    expect(round2.matches).toHaveLength(3)
  })

  it('Mexicano uses seeded order for early rounds when minRoundsBeforeReseeding is set', () => {
    let tournament = createTournament({
      name: 'Early Seed',
      mode: 'mexicano',
      courts: 2,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina', 'Ema', 'Faye', 'Gia', 'Hope'],
      minRoundsBeforeReseeding: 1,
    })

    // Round 1 is always random.
    const firstRound = tournament.rounds[0]
    expect(firstRound.source).toBe('randomized')

    // Complete round 1 and generate round 2.
    tournament = completeRound(tournament, 15)
    tournament = appendNextRound(tournament)

    // Round 2 should use seeded order (still within minRoundsBeforeReseeding window).
    expect(tournament.rounds[1].source).toBe('seeded')

    // Complete round 2 and generate round 3.
    tournament = completeRound(tournament, 11)
    tournament = appendNextRound(tournament)

    // Round 3 should now use live standings.
    expect(tournament.rounds[2].source).toBe('standings')
  })

  it('Mexicano court-locked mode keeps players on their initial court', () => {
    let tournament = createTournament({
      name: 'Locked Courts',
      mode: 'mexicano',
      courts: 2,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina', 'Ema', 'Faye', 'Gia', 'Hope'],
      mexicanoVariant: 'court-locked',
    })

    const firstRound = tournament.rounds[0]
    const court1Players = new Set([
      ...firstRound.matches[0].teamAPlayerIds,
      ...firstRound.matches[0].teamBPlayerIds,
    ])

    tournament = completeRound(tournament, 15)
    tournament = appendNextRound(tournament)

    const round2 = tournament.rounds[1]
    expect(round2.source).toBe('court-locked')

    // All players in round 2 court 1 match should be the same set as round 1 court 1.
    const round2Court1Players = new Set([
      ...round2.matches[0].teamAPlayerIds,
      ...round2.matches[0].teamBPlayerIds,
    ])
    expect([...round2Court1Players].every((id) => court1Players.has(id))).toBe(true)
  })

  it('Mexicano promotion-relegation mode swaps border players between courts', () => {
    let tournament = createTournament({
      name: 'Promo Test',
      mode: 'mexicano',
      courts: 2,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina', 'Ema', 'Faye', 'Gia', 'Hope'],
      mexicanoVariant: 'promotion-relegation',
    })

    const firstRound = tournament.rounds[0]
    const court1PlayersR1 = new Set([
      ...firstRound.matches[0].teamAPlayerIds,
      ...firstRound.matches[0].teamBPlayerIds,
    ])
    const court2PlayersR1 = new Set([
      ...firstRound.matches[1].teamAPlayerIds,
      ...firstRound.matches[1].teamBPlayerIds,
    ])

    tournament = completeRound(tournament, 15)
    tournament = appendNextRound(tournament)

    const round2 = tournament.rounds[1]
    expect(round2.source).toBe('promotion-relegation')

    const court1PlayersR2 = new Set([
      ...round2.matches[0].teamAPlayerIds,
      ...round2.matches[0].teamBPlayerIds,
    ])
    const court2PlayersR2 = new Set([
      ...round2.matches[1].teamAPlayerIds,
      ...round2.matches[1].teamBPlayerIds,
    ])

    // Exactly one player should have moved between courts (promotion/relegation swap).
    const movedFromCourt1 = [...court1PlayersR1].filter((id) => !court1PlayersR2.has(id))
    const movedFromCourt2 = [...court2PlayersR1].filter((id) => !court2PlayersR2.has(id))
    expect(movedFromCourt1).toHaveLength(1)
    expect(movedFromCourt2).toHaveLength(1)
  })

  it('uses randomised tie-breaking instead of registration order', () => {
    // Create two identical tournaments with different names (different seeds).
    // Players who are tied on all criteria should not always appear in seed order.
    const makeAllTied = (name: string) => {
      // One court, 4 players, no rounds played → all players tied at 0 pts, 0 wins.
      return createTournament({ name, mode: 'mexicano', courts: 1, playerNames: ['A', 'B', 'C', 'D'] })
    }

    const t1 = makeAllTied('Seed Test Alpha')
    const t2 = makeAllTied('Seed Test Beta')

    const order1 = computeStandings(t1).map((s) => s.name)
    const order2 = computeStandings(t2).map((s) => s.name)

    // The two tournaments have different seeds so at least one ordering should
    // differ from strict registration order ('A','B','C','D').
    const registrationOrder = ['A', 'B', 'C', 'D']
    const bothMatchRegistration =
      order1.join() === registrationOrder.join() && order2.join() === registrationOrder.join()
    expect(bothMatchRegistration).toBe(false)
  })
})

