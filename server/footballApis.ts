import type { IncomingMessage, ServerResponse } from 'node:http'

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function records(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
function textValue(...values: unknown[]): string | undefined { return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() }
function firstArray(source: Record<string, unknown>, keys: string[]): unknown[] | undefined { for (const key of keys) { const value = source[key]; if (Array.isArray(value)) return value; const nested = record(value); for (const childKey of ['players', 'startingXI', 'starting_xi', 'starting', 'lineup', 'substitutes', 'substitutePlayers', 'bench', 'events', 'items', 'incidents', 'goals']) if (Array.isArray(nested[childKey])) return nested[childKey] as unknown[] } return undefined }

export function premierLeagueMatchProxy() {
  const cache = new Map<number, { expiresAt: number; value: string }>()
  let seasonCatalogue: { expiresAt: number; seasons: unknown[] } | undefined
  let standingsCache: { expiresAt: number; value: string } | undefined
  let pendingStandings: Promise<string> | undefined
  const standingsHeaders = { Accept: 'application/json', Origin: 'https://www.premierleague.com', 'User-Agent': 'Mozilla/5.0' }
  const loadStandings = async () => {
    if (!seasonCatalogue || seasonCatalogue.expiresAt <= Date.now()) {
      const response = await fetch('https://footballapi.pulselive.com/football/competitions/1/compseasons?page=0&pageSize=50&sort=desc', { headers: standingsHeaders, signal: AbortSignal.timeout(12_000) })
      if (!response.ok) throw new Error('Season catalogue unavailable')
      const payload = record(await response.json())
      const seasons = records(payload.content)
      if (!seasons.length) throw new Error('Season catalogue unavailable')
      seasonCatalogue = { expiresAt: Date.now() + 24 * 60 * 60_000, seasons }
    }
    const season = record(seasonCatalogue.seasons.find((item) => String(record(item).label || '').includes('2026/2027')))
    const seasonId = Number(season.id)
    if (!Number.isSafeInteger(seasonId) || seasonId <= 0) throw new Error('Season unavailable')
    const response = await fetch(`https://footballapi.pulselive.com/football/compseasons/${seasonId}/standings`, { headers: standingsHeaders, signal: AbortSignal.timeout(12_000) })
    if (!response.ok) throw new Error('Standings unavailable')
    const payload = record(await response.json())
    const entries = records(record(records(payload.tables)[0]).entries)
    const standings = entries.map((item) => {
      const entry = record(item)
      const team = record(entry.team)
      const club = record(team.club)
      const overall = record(entry.overall)
      const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
      const annotations = records(entry.annotations).map(record)
      const destination = annotations.find((annotation) => typeof annotation.destination === 'string')?.destination
      const description = destination === 'EU_CL' ? 'UEFA Champions League' : destination === 'EU_EL' ? 'UEFA Europa League' : destination === 'EU_ECL' ? 'UEFA Conference League' : annotations.some((annotation) => annotation.type === 'R') ? 'Relegation' : undefined
      return {
        rank: number(entry.position), previousRank: number(entry.startingPosition),
        team: { id: number(team.id), name: textValue(club.shortName, team.shortName, team.name), logo: '' },
        points: number(overall.points), goalsDiff: number(overall.goalsDifference), description, annotations,
        all: { played: number(overall.played), win: number(overall.won), draw: number(overall.drawn), lose: number(overall.lost), goals: { for: number(overall.goalsFor), against: number(overall.goalsAgainst) } },
      }
    })
    if (standings.length !== 20 || standings.some((entry) => !entry.rank || !entry.team.id || !entry.team.name || Object.values(entry.all).some((value) => value === undefined) || entry.points === undefined || entry.goalsDiff === undefined || entry.all.goals.for === undefined || entry.all.goals.against === undefined)) throw new Error('Incomplete standings')
    const value = JSON.stringify({ source: 'Premier League', season: 2026, updatedAt: new Date().toISOString(), response: [{ league: { id: 39, name: 'Premier League', season: 2026, standings: [standings] } }] })
    standingsCache = { expiresAt: Date.now() + 5 * 60_000, value }
    return value
  }
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(); return }
    const requestUrl = new URL(req.url || '/', 'http://localhost')
    const path = requestUrl.pathname
    if (path === '/standings') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (requestUrl.searchParams.get('season') !== '2026') { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Premier League season.' })); return }
      const origin = req.headers.origin
      if (origin && req.headers.host) {
        try { if (new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' })); return } }
        catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Invalid request origin.' })); return }
      }
      try {
        if (!standingsCache || standingsCache.expiresAt <= Date.now()) {
          if (!pendingStandings) pendingStandings = loadStandings().finally(() => { pendingStandings = undefined })
          await pendingStandings
        }
        if (!standingsCache) throw new Error('Standings unavailable')
        res.setHeader('Cache-Control', 'public, max-age=60'); res.end(standingsCache.value)
      } catch { res.statusCode = 502; res.end(JSON.stringify({ error: 'The official Premier League table is temporarily unavailable.' })) }
      return
    }
    const match = path.match(/^\/matches\/(\d{1,10})\/report$/)
    if (!match) { next(); return }
    const matchId = Number(match[1])
    const cached = cache.get(matchId)
    if (cached && cached.expiresAt > Date.now()) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'public, max-age=3600'); res.end(cached.value); return }
    const headers = { Accept: 'application/json', Origin: 'https://www.premierleague.com', 'User-Agent': 'Mozilla/5.0' }
    const fetchResource = async (version: string, resource: 'events' | 'lineups') => {
      const bases = ['https://sdp-prem-prod.premier-league-prod.pulselive.com', 'https://footballapi.pulselive.com/football']
      for (const base of bases) {
        try {
          const response = await fetch(`${base}/api/${version}/matches/${matchId}/${resource}`, { headers, signal: AbortSignal.timeout(12_000) })
          if (response.ok) return await response.json() as unknown
        } catch { /* Try the league's alternate match-centre host. */ }
      }
      return undefined
    }
    try {
      const [eventPayload, lineupPayload] = await Promise.all([fetchResource('v1', 'events'), fetchResource('v3', 'lineups')])
      if (eventPayload === undefined && lineupPayload === undefined) { res.statusCode = 502; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Premier League match details are unavailable.' })); return }

      const eventRoot = record(eventPayload)
      const sideEvents = (side: 'home' | 'away') => {
        const upper = side === 'home' ? 'homeTeam' : 'awayTeam'
        const lower = side === 'home' ? 'home_team' : 'away_team'
        const direct = eventRoot[upper] ?? eventRoot[lower] ?? record(eventRoot.events)[upper] ?? record(eventRoot.events)[lower]
        if (Array.isArray(direct)) return { available: true, items: direct }
        const nested = record(direct)
        const items = firstArray(nested, ['events', 'items', 'incidents', 'goals'])
        return { available: Boolean(items), items: items || [] }
      }
      const minuteLabel = (item: Record<string, unknown>) => {
        const raw = item.time ?? item.minute ?? item.clock
        const time = record(raw)
        const value = time.minute ?? time.display ?? time.label ?? raw
        if (typeof value === 'number') return `${value}′`
        const label = textValue(value)
        return label ? (/['′]/.test(label) ? label : `${label}′`) : '—'
      }
      const lineupRoot = record(lineupPayload)
      const lineupTeam = (side: 'home' | 'away') => record(lineupRoot[side === 'home' ? 'home_team' : 'away_team'] ?? lineupRoot[side === 'home' ? 'homeTeam' : 'awayTeam'] ?? lineupRoot[side])
      const nameByPlayerId = new Map<string, string>()
      for (const side of ['home', 'away'] as const) {
        const team = lineupTeam(side)
        for (const raw of firstArray(team, ['players']) || []) {
          const player = record(raw)
          const name = textValue(player.knownName, [player.firstName, player.lastName].filter((part) => typeof part === 'string' && part).join(' '), player.displayName, player.name)
          if (name && player.id !== undefined) nameByPlayerId.set(String(player.id), name)
        }
      }
      const sideGoalItems = (side: 'home' | 'away') => {
        const upper = side === 'home' ? 'homeTeam' : 'awayTeam'
        const lower = side === 'home' ? 'home_team' : 'away_team'
        const nested = record(eventRoot[upper] ?? eventRoot[lower] ?? record(eventRoot.events)[upper] ?? record(eventRoot.events)[lower])
        return firstArray(nested, ['goals']) || []
      }
      const goals = (['home', 'away'] as const).flatMap((side) => sideEvents(side).items.flatMap((raw) => {
        const item = record(raw)
        const kindValue = item.type ?? item.eventType ?? item.typeName ?? item.action ?? item.description
        const kindObject = record(kindValue)
        const kind = (typeof kindValue === 'string' ? kindValue : textValue(kindObject.name, kindObject.label, kindObject.description))?.toLowerCase() || ''
        if (!kind.includes('goal') && !sideGoalItems(side).includes(raw)) return []
        const player = record(item.player ?? item.scorer ?? item.person)
        const assist = record(item.assist ?? item.assister)
        const scorer = textValue(item.playerName, item.scorerName, player.displayName, player.name, player.fullName, item.name, nameByPlayerId.get(String(item.playerId ?? player.id ?? '')))
        if (!scorer) return []
        const assistName = textValue(item.assistName, assist.displayName, assist.name, record(item.assistPlayer).name, nameByPlayerId.get(String(item.assistPlayerId ?? assist.id ?? '')))
        return [{ side, minute: minuteLabel(item), scorer, ...(assistName ? { assist: assistName } : {}) }]
      }))

      const lineupFor = (side: 'home' | 'away') => {
        const team = lineupTeam(side)
        const teamPlayers = firstArray(team, ['players'])
        const formation = record(team.formation)
        const startingIds = new Set((Array.isArray(formation.lineup) ? formation.lineup.flatMap((line) => Array.isArray(line) ? line : []) : []).map(String))
        const starters = startingIds.size ? teamPlayers?.filter((raw) => startingIds.has(String(record(raw).id))) : firstArray(team, ['startingXI', 'starting_xi', 'starting', 'players', 'lineup'])
        const isSubstitute = (raw: unknown) => {
          const item = record(raw)
          const state = textValue(item.role, item.type, item.status)?.toLowerCase() || ''
          const positionValue = item.position
          const positionLabel = typeof positionValue === 'string' ? positionValue : textValue(record(positionValue).name, record(positionValue).label)
          return item.isSubstitute === true || item.substitute === true || state.includes('substitute') || state === 'bench' || state === 'sub' || positionLabel?.toLowerCase() === 'substitute'
        }
        const playerDetails = (raw: unknown) => {
          const item = record(raw)
          const player = record(item.player ?? item)
          const positionValue = item.position
          const positionLabel = typeof positionValue === 'string' ? positionValue : textValue(record(positionValue).name, record(positionValue).label)
          const name = textValue(item.knownName, item.playerName, typeof item.player === 'string' ? item.player : undefined, [item.firstName, item.lastName].filter((part) => typeof part === 'string' && part).join(' '), player.displayName, player.name, player.fullName, item.name, record(item.person).name)
          if (!name) return []
          const number = item.shirtNumber ?? item.shirt_number ?? item.shirtNum ?? item.number ?? player.shirtNumber ?? player.shirt_num
          const position = positionLabel || textValue(player.position)
          return { name, ...(number !== undefined ? { shirtNumber: String(number) } : {}), ...(position ? { position } : {}) }
        }
        const players = (starters || []).flatMap((raw) => !startingIds.size && isSubstitute(raw) ? [] : playerDetails(raw))
        const explicitBench = firstArray(team, ['substitutes', 'substitutePlayers', 'bench'])
        const benchSource = explicitBench ?? (startingIds.size ? teamPlayers?.filter((raw) => !startingIds.has(String(record(raw).id))) : teamPlayers?.filter(isSubstitute)) ?? []
        const bench = benchSource.flatMap(playerDetails)
        const benchAvailable = explicitBench !== undefined || Boolean(startingIds.size && teamPlayers) || bench.length > 0
        return { available: teamPlayers !== undefined || Boolean(starters?.length), players, bench, benchAvailable }
      }
      const home = lineupFor('home')
      const away = lineupFor('away')
      const eventAvailability = sideEvents('home').available || sideEvents('away').available
      const lineupsAvailable = home.available || away.available
      const result = JSON.stringify({ goals, homeStarters: home.players, awayStarters: away.players, homeBench: home.bench, awayBench: away.bench, benchAvailable: home.benchAvailable || away.benchAvailable, eventsAvailable: eventAvailability, lineupsAvailable })
      cache.set(matchId, { expiresAt: Date.now() + 60 * 60 * 1000, value: result })
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'public, max-age=3600'); res.end(result)
    } catch {
      if (!res.headersSent) { res.statusCode = 502; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Premier League match details are unavailable.' })) }
    }
  }
  return { name: 'premier-league-match-report-proxy', configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/premier-league', middleware) }, configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/premier-league', middleware) } }
}

export function fplProxy() {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(); return }
    const path = new URL(req.url || '/', 'http://localhost').pathname
    const endpoint = path === '/bootstrap' ? 'bootstrap-static/' : path === '/fixtures' ? 'fixtures/' : ''
    if (!endpoint) { next(); return }
    const event = new URL(req.url || '/', 'http://localhost').searchParams.get('event')
    if (event && (!/^\d{1,2}$/.test(event) || endpoint !== 'fixtures/')) { res.statusCode = 400; res.end('Invalid event'); return }
    try {
      const upstream = await fetch(`https://fantasy.premierleague.com/api/${endpoint}${event ? `?event=${event}` : ''}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) })
      if (!upstream.ok) { res.statusCode = 502; res.end(JSON.stringify({ error: 'Fantasy Premier League data is unavailable.' })); return }
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'public, max-age=30'); res.end(await upstream.text())
    } catch { if (!res.headersSent) { res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Fantasy Premier League data is unavailable.' })) } }
  }
  return { name: 'fpl-public-data-proxy', configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/fpl', middleware) }, configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/fpl', middleware) } }
}

export function apiFootballProxy(apiKey: string) {
  const cache = new Map<string, { expiresAt: number; value: string }>()
  const requests = new Map<string, number[]>()
  const allowedLeagues = new Set([39, 140, 135, 78, 61])
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(); return }
    const requestUrl = new URL(req.url || '/', 'http://localhost')
    const resource = requestUrl.pathname.replace(/^\/api\/football-data\//, '').replace(/^\//, '')
    if (!['fixtures', 'standings', 'topscorers', 'fixture-details'].includes(resource)) { next(); return }
    const league = requestUrl.searchParams.get('league') || ''
    const season = requestUrl.searchParams.get('season') || ''
    const ids = requestUrl.searchParams.get('ids') || ''
    if (resource !== 'fixture-details' && (!/^\d{1,3}$/.test(league) || !allowedLeagues.has(Number(league)) || !/^20\d{2}$/.test(season))) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Invalid league or season.' })); return
    }
    if (resource === 'fixture-details' && (!/^\d+(?:-\d+){0,19}$/.test(ids) || ids.length > 220)) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Invalid fixture identifiers.' })); return
    }
    const cacheKey = `${resource}?${resource === 'fixture-details' ? `ids=${ids}` : `league=${league}&season=${season}`}`
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'private, max-age=30'); res.end(cached.value); return }
    if (!apiKey) { res.statusCode = 503; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Multi-league live data is not connected yet. Add API_FOOTBALL_KEY to .env.local and restart the app.' })); return }
    const origin = req.headers.origin
    if (origin && req.headers.host) {
      try { if (new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' })); return } }
      catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Invalid request origin.' })); return }
    }
    const client = req.socket.remoteAddress || 'local'
    const recent = (requests.get(client) || []).filter((time) => Date.now() - time < 60_000)
    if (recent.length >= 8) { res.statusCode = 429; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Multi-league data is being requested too quickly. Wait a moment and retry.' })); return }
    recent.push(Date.now()); requests.set(client, recent)
    const upstreamResource = resource === 'fixture-details' ? 'fixtures' : resource === 'topscorers' ? 'players/topscorers' : resource
    const upstreamUrl = new URL(`https://v3.football.api-sports.io/${upstreamResource}`)
    if (resource === 'fixture-details') upstreamUrl.searchParams.set('ids', ids)
    else { upstreamUrl.searchParams.set('league', league); upstreamUrl.searchParams.set('season', season) }
    try {
      const upstream = await fetch(upstreamUrl, { headers: { 'x-apisports-key': apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
      const text = await upstream.text()
      if (!upstream.ok) {
        res.statusCode = upstream.status === 429 ? 429 : upstream.status === 403 ? 503 : 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: upstream.status === 403 ? 'The API key or season does not have access to this league.' : upstream.status === 429 ? 'The football data provider request limit has been reached. Try again later.' : 'The football data provider is temporarily unavailable.' }))
        return
      }
      const parsed = JSON.parse(text) as { errors?: unknown; response?: unknown[] }
      if (parsed.errors && (Array.isArray(parsed.errors) ? parsed.errors.length > 0 : Object.keys(parsed.errors as Record<string, unknown>).length > 0)) {
        res.statusCode = 502; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'The football data provider could not return this league or season.' })); return
      }
      const ttl = resource === 'fixture-details' ? 60 * 60_000 : resource === 'standings' || resource === 'topscorers' ? 5 * 60_000 : 60_000
      cache.set(cacheKey, { expiresAt: Date.now() + ttl, value: text })
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'private, max-age=30'); res.end(text)
    } catch {
      if (!res.headersSent) { res.statusCode = 502; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Could not reach the football data provider.' })) }
    }
  }
  return { name: 'multi-league-football-data-proxy', configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/football-data', middleware) }, configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/football-data', middleware) } }
}
