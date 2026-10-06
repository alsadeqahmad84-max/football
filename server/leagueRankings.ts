import type { IncomingMessage, ServerResponse } from 'node:http'

type Standing = { rank: number; previousRank?: number; team: { id: number; name: string; logo: string }; points: number; goalsDiff: number; description?: string; all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } } }
type Scorer = { player: { id: number; name: string; photo?: string }; statistics: { league: { id: number; season: number }; team: { id: number; name: string; logo?: string }; games?: { minutes?: number | null }; goals: { total: number; assists?: number | null } }[] }
type Rankings = { standings: Standing[]; scorers: Scorer[]; source: string; updatedAt: string; standingsError?: string; scorersError?: string }
type LeagueId = 'laliga' | 'bundesliga'
type ObjectRecord = Record<string, unknown>
const object = (value: unknown): ObjectRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectRecord : {}
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const label = (...values: unknown[]): string => values.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() || ''
const numeric = (value: unknown): number => {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') throw new Error('Invalid statistic')
  const result = Number(value)
  if (!Number.isFinite(result)) throw new Error('Invalid statistic')
  return result
}
const imageUrl = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  try { const url = new URL(value); return url.protocol === 'https:' && ['assets.laliga.com', 'assets.bundesliga.com'].includes(url.hostname) ? url.href : '' } catch { return '' }
}

async function publicHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: 'text/html' }, redirect: 'error', signal: AbortSignal.timeout(15_000) })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || Number(response.headers.get('content-length') || 0) > 4_000_000) throw new Error('Official page unavailable')
  const html = await response.text()
  if (html.length > 4_000_000) throw new Error('Official page too large')
  return html
}

function nextPageProps(html: string): ObjectRecord {
  const data = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!data) throw new Error('Official data unavailable')
  const props = object(object(object(JSON.parse(data)).props).pageProps)
  if (String(props.season) !== '2026') throw new Error('Current season unavailable')
  return props
}

function angularState(html: string): { state: ObjectRecord; seasonId: string } {
  const data = html.match(/<script[^>]*id="(?:serverApp-state|ng-state)"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!data) throw new Error('Official data unavailable')
  const state = object(JSON.parse(data))
  const current = Object.values(state).map((value) => object(object(object(value).b)['DFL-COM-000001'])).find((value) => object(value.season).name === '2026-2027')
  const seasonId = label(object(current?.season).seasonId, object(current?.season).dflDatalibrarySeasonId)
  if (!/^DFL-SEA-[A-Z0-9]+$/.test(seasonId)) throw new Error('Current season unavailable')
  return { state, seasonId }
}

function validateTable(standings: Standing[], clubs: number): Standing[] {
  if (standings.length !== clubs || new Set(standings.map((entry) => entry.team.id)).size !== clubs || standings.some((entry) => !entry.team.name || entry.rank < 1 || entry.rank > clubs || entry.all.played < 0)) throw new Error('Incomplete current standings')
  return standings.sort((a, b) => a.rank - b.rank)
}

async function laLigaRankings(): Promise<Rankings> {
  const [tablePage, scorerPage] = await Promise.allSettled([
    publicHtml('https://www.laliga.com/en-GB/laliga-easports/standing').then(nextPageProps),
    publicHtml('https://www.laliga.com/en-GB/stats/laliga-easports/scorers').then(nextPageProps),
  ])
  const result: Rankings = { standings: [], scorers: [], source: 'LALIGA', updatedAt: new Date().toISOString() }
  const teams = scorerPage.status === 'fulfilled' ? array(scorerPage.value.sortedTeams).map(object) : []
  const teamLogos = new Map(teams.map((team) => [Number(team.id), imageUrl(object(team.shield).url)]))
  if (tablePage.status === 'fulfilled') {
    try {
      result.standings = validateTable(array(tablePage.value.standings).map((item) => {
        const entry = object(item), team = object(entry.team)
        return { rank: numeric(entry.position), previousRank: numeric(entry.previous_position), team: { id: numeric(team.id), name: label(team.nickname, team.boundname, team.name), logo: teamLogos.get(Number(team.id)) || imageUrl(object(team.shield).url) }, points: numeric(entry.points), goalsDiff: numeric(entry.goal_difference), description: label(object(entry.qualify).name) || undefined, all: { played: numeric(entry.played), win: numeric(entry.won), draw: numeric(entry.drawn), lose: numeric(entry.lost), goals: { for: numeric(entry.goals_for), against: numeric(entry.goals_against) } } }
      }), 20)
    } catch { result.standingsError = 'The official LALIGA standings are temporarily unavailable.' }
  } else result.standingsError = 'The official LALIGA standings are temporarily unavailable.'
  if (scorerPage.status === 'fulfilled') {
    try {
      const players = array(object(scorerPage.value.statsData).player_rankings)
      if (!players.length) throw new Error('Scorers unavailable')
      result.scorers = players.slice(0, 20).map((item) => {
        const player = object(item), team = object(player.team)
        const stats = new Map(array(player.stats).map((item) => { const stat = object(item); return [String(stat.name), stat.stat] as const }))
        const photo = object(object(player.photos)['001'])
        return { player: { id: numeric(player.id), name: label(player.nickname, player.name), photo: imageUrl(photo['256x278'] || photo['128x139'] || Object.values(photo)[0]) || undefined }, statistics: [{ league: { id: 140, season: 2026 }, team: { id: numeric(team.id), name: label(team.nickname, team.boundname, team.name), logo: imageUrl(object(team.shield).url) || undefined }, games: { minutes: stats.has('total_mins_played') ? numeric(stats.get('total_mins_played')) : null }, goals: { total: numeric(stats.get('total_goals')), assists: stats.has('total_assists') ? numeric(stats.get('total_assists')) : null } }] }
      })
      if (result.scorers.some((item) => !item.player.name || !item.statistics[0].team.name || item.statistics[0].goals.total < 0)) throw new Error('Incomplete scorers')
    } catch { result.scorers = []; result.scorersError = 'The official LALIGA top scorers are temporarily unavailable.' }
  } else result.scorersError = 'The official LALIGA top scorers are temporarily unavailable.'
  return result
}

function dflId(value: unknown): number {
  const match = String(value || '').match(/^DFL-(?:CLU|OBJ)-([A-Z0-9]+)$/)
  if (!match) throw new Error('Invalid official identifier')
  const id = parseInt(match[1], 36)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid official identifier')
  return id
}

async function bundesligaRankings(): Promise<Rankings> {
  const [tablePage, scorerPage] = await Promise.allSettled([
    publicHtml('https://www.bundesliga.com/en/bundesliga/table').then(angularState),
    publicHtml('https://www.bundesliga.com/en/bundesliga/stats/players/goals').then(angularState),
  ])
  const result: Rankings = { standings: [], scorers: [], source: 'Bundesliga', updatedAt: new Date().toISOString() }
  const clubNames = new Map<string, string>()
  if (tablePage.status === 'fulfilled') {
    try {
      const { state, seasonId } = tablePage.value
      const key = Object.keys(state).find((key) => key.includes(`/DFL-COM-000001/seasons/${seasonId}/`) && key.endsWith('/liveTable'))
      const table = object(key ? state[key] : undefined)
      if (object(table.season).name !== '2026-2027') throw new Error('Current table unavailable')
      result.standings = validateTable(array(table.entries).map((item) => {
        const entry = object(item), club = object(entry.club)
        const name = label(club.nameFull, club.nameShort)
        clubNames.set(label(club.dflDatalibraryClubId, club.id), name)
        return { rank: numeric(entry.rank), team: { id: dflId(club.id || club.dflDatalibraryClubId), name, logo: imageUrl(club.logoUrl) }, points: numeric(entry.points), goalsDiff: numeric(entry.goalDifference), description: typeof entry.qualification === 'string' && entry.qualification !== 'NONE' ? entry.qualification.replace(/_/g, ' ') : undefined, all: { played: numeric(entry.gamesPlayed), win: numeric(entry.wins), draw: numeric(entry.draws), lose: numeric(entry.losses), goals: { for: numeric(entry.goalsScored), against: numeric(entry.goalsAgainst) } } }
      }), 18)
    } catch { result.standingsError = 'The official Bundesliga standings are temporarily unavailable.' }
  } else result.standingsError = 'The official Bundesliga standings are temporarily unavailable.'
  if (scorerPage.status === 'fulfilled') {
    try {
      const { state, seasonId } = scorerPage.value
      const key = Object.keys(state).find((key) => key.includes(`/DFL-COM-000001/seasons/${seasonId}/stats/playerRankings/shotsAtGoalSuccessfulindex`))
      const players = array(key ? state[key] : undefined)
      if (!players.length) throw new Error('Scorers unavailable')
      result.scorers = players.slice(0, 20).map((item) => {
        const player = object(item), club = object(player.club), clubId = label(club.dflDatalibraryClubId)
        return { player: { id: dflId(player.dflDatalibraryObjectId), name: label(player.name), photo: imageUrl(player.imageUrl) || undefined }, statistics: [{ league: { id: 78, season: 2026 }, team: { id: dflId(clubId), name: clubNames.get(clubId) || 'Bundesliga club', logo: imageUrl(club.logoUrl) || undefined }, goals: { total: numeric(player.value), assists: null } }] }
      })
      if (result.scorers.some((item) => !item.player.name || item.statistics[0].goals.total < 0)) throw new Error('Incomplete scorers')
    } catch { result.scorers = []; result.scorersError = 'The official Bundesliga top scorers are temporarily unavailable.' }
  } else result.scorersError = 'The official Bundesliga top scorers are temporarily unavailable.'
  return result
}

export function leagueRankingsProxy() {
  const cache = new Map<LeagueId, { expiresAt: number; value: Rankings; status: number }>()
  const pending = new Map<LeagueId, Promise<Rankings>>()
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname !== '/') { next(); return }
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'Use GET to view league rankings.' })); return }
    const league = url.searchParams.get('league')
    if ((league !== 'laliga' && league !== 'bundesliga') || url.searchParams.get('season') !== '2026') { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid league or season.' })); return }
    const origin = req.headers.origin
    if (origin && req.headers.host) {
      try { if (new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' })); return } }
      catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Invalid request origin.' })); return }
    }
    try {
      let cached = cache.get(league)
      if (!cached || cached.expiresAt <= Date.now()) {
        let request = pending.get(league)
        if (!request) {
          request = (league === 'laliga' ? laLigaRankings() : bundesligaRankings()).then((value) => {
            const available = value.standings.length > 0 || value.scorers.length > 0
            cache.set(league, { expiresAt: Date.now() + (available ? 5 * 60_000 : 30_000), value, status: available ? 200 : 502 })
            return value
          }).finally(() => { pending.delete(league) })
          pending.set(league, request)
        }
        await request
        cached = cache.get(league)
      }
      if (!cached) throw new Error('Official rankings unavailable')
      res.statusCode = cached.status; res.setHeader('Cache-Control', 'public, max-age=30'); res.end(JSON.stringify(cached.value))
    } catch { res.statusCode = 502; res.end(JSON.stringify({ error: 'The official league rankings are temporarily unavailable.' })) }
  }
  return { name: 'official-league-rankings-proxy', configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/league-rankings', middleware) }, configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/league-rankings', middleware) } }
}
