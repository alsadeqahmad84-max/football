import type { ScorerRow, StandingRow } from './LeagueRankings'

type Team = { id: number; name: string; code: number }
type Fixture = { id: number; team_h: number; team_a: number; finished: boolean; kickoff_time: string | null; team_h_score: number | null; team_a_score: number | null }
type Player = { id: number; web_name: string; first_name?: string; second_name?: string; photo?: string; team: number; goals_scored?: number; assists?: number; minutes: number }
export type ApiStanding = { rank: number; team: { id: number; name: string; logo: string }; points: number; goalsDiff: number; form?: string | null; all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } } }
export type ApiTopScorer = { player: { id: number; name: string; photo?: string }; statistics: { league?: { id: number; season: number }; team: { id: number; name: string; logo?: string }; games?: { appearences?: number | null; minutes?: number | null }; goals?: { total?: number | null; assists?: number | null } }[] }

export function buildFplStandings(teams: Team[], fixtures: Fixture[], badgeFor: (team: Team) => string): StandingRow[] {
  const rows = new Map(teams.map((team) => [team.id, { id: team.id, rank: 0, name: team.name, logo: badgeFor(team), played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: '' }]))
  const finished = fixtures.filter((fixture) => fixture.finished && fixture.team_h_score !== null && fixture.team_a_score !== null).sort((a, b) => (a.kickoff_time || '').localeCompare(b.kickoff_time || '') || a.id - b.id)
  for (const fixture of finished) {
    const home = rows.get(fixture.team_h)
    const away = rows.get(fixture.team_a)
    if (!home || !away) continue
    const homeGoals = fixture.team_h_score!
    const awayGoals = fixture.team_a_score!
    home.played++; away.played++
    home.goalsFor += homeGoals; home.goalsAgainst += awayGoals
    away.goalsFor += awayGoals; away.goalsAgainst += homeGoals
    if (homeGoals === awayGoals) {
      home.drawn++; away.drawn++; home.points++; away.points++
      home.form += 'D'; away.form += 'D'
    } else {
      const winner = homeGoals > awayGoals ? home : away
      const loser = winner === home ? away : home
      winner.won++; winner.points += 3; winner.form += 'W'
      loser.lost++; loser.form += 'L'
    }
  }
  return [...rows.values()].map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst, form: row.form.slice(-5) })).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name)).map((row, index) => ({ ...row, rank: index + 1 }))
}

export function buildFplScorers(players: Player[], teams: Team[], badgeFor: (team: Team) => string): ScorerRow[] {
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const rows = players.filter((player) => Number.isFinite(player.goals_scored) && player.goals_scored! > 0).map((player) => {
    const team = teamMap.get(player.team)
    const photoId = player.photo?.match(/^([0-9]+)(?:\.\w+)?$/)?.[1]
    return { id: player.id, rank: 0, name: `${player.first_name || ''} ${player.second_name || ''}`.trim() || player.web_name, photo: photoId ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoId}.png` : undefined, club: team?.name || 'Club unavailable', clubLogo: team ? badgeFor(team) : undefined, goals: player.goals_scored!, assists: player.assists, minutes: player.minutes }
  }).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 20)
  return sharedGoalRanks(rows)
}

export function mapApiStandings(rows: ApiStanding[]): StandingRow[] {
  return rows.filter((row) => row.team && row.all).map((row) => ({ id: row.team.id, rank: row.rank, name: row.team.name, logo: row.team.logo, played: row.all.played, won: row.all.win, drawn: row.all.draw, lost: row.all.lose, goalsFor: row.all.goals.for, goalsAgainst: row.all.goals.against, goalDifference: row.goalsDiff, points: row.points, form: row.form?.replace(/[^WDL]/gi, '').toUpperCase() })).sort((a, b) => a.rank - b.rank)
}

export function mapApiScorers(players: ApiTopScorer[], leagueId: number, season = 2026): ScorerRow[] {
  return sharedGoalRanks(players.flatMap(({ player, statistics }) => {
    const stats = statistics?.find((item) => item.league?.id === leagueId && item.league.season === season)
    if (!player || !stats?.team || typeof stats.goals?.total !== 'number' || stats.goals.total < 1) return []
    return [{ id: player.id, rank: 0, name: player.name, photo: player.photo, club: stats.team.name, clubLogo: stats.team.logo, goals: stats.goals.total, assists: stats.goals.assists ?? undefined, appearances: stats.games?.appearences ?? undefined, minutes: stats.games?.minutes ?? undefined }]
  }).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)))
}

function sharedGoalRanks(rows: ScorerRow[]): ScorerRow[] {
  let rank = 0
  return rows.map((row, index) => {
    if (index === 0 || row.goals !== rows[index - 1].goals) rank = index + 1
    return { ...row, rank }
  })
}
