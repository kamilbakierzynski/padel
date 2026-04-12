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

  it('ranks standings by total points then differential', () => {
    let tournament = createTournament({
      name: 'Standings',
      mode: 'americano',
      courts: 1,
      playerNames: ['Ava', 'Bea', 'Cleo', 'Dina'],
    })

    const round = tournament.rounds[0]
    tournament = updateMatchScore(tournament, round.id, round.matches[0].id, 15).tournament

    const standings = computeStandings(tournament)

    expect(standings[0].totalPoints).toBe(15)
    expect(standings[0].differential).toBe(9)
    expect(standings.at(-1)?.totalPoints).toBe(6)
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
})
