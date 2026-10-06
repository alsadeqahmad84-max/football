import type { IncomingMessage, ServerResponse } from 'node:http'

type LeagueId = 'premier' | 'laliga' | 'serie-a' | 'bundesliga' | 'ligue-1'
type Coach = { id: string; name: string; club: string; clubId?: string; clubLogo?: string; photo?: string; nationality?: string; age?: number; appointedAt?: string; profileUrl?: string }
type Coaches = { coaches: Coach[]; source: string; sourceUrl: string; updatedAt: string; error?: string; message?: string }
type ObjectRecord = Record<string, unknown>

const object = (value: unknown): ObjectRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectRecord : {}
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const label = (...values: unknown[]): string => values.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() || ''
const directories: Record<LeagueId, { source: string; url: string; clubs: number }> = {
  premier: { source: 'Official Premier League', url: 'https://www.premierleague.com/en/managers', clubs: 20 },
  laliga: { source: 'Official LALIGA', url: 'https://www.laliga.com/en-GB/laliga-easports/clubs', clubs: 20 },
  'serie-a': { source: 'Official Lega Serie A', url: 'https://www.legaseriea.it/team/index', clubs: 20 },
  bundesliga: { source: 'Official Bundesliga', url: 'https://www.bundesliga.com/en/bundesliga/clubs', clubs: 18 },
  'ligue-1': { source: 'Official Ligue 1', url: 'https://ligue1.com/en', clubs: 18 },
}

function safeImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    const officialAsset = ['resources.premierleague.com', 'assets.bundesliga.com', 'assets.laliga.com', 'media-sdp.legaseriea.it'].includes(url.hostname) || (url.hostname === 's3.eu-west-1.amazonaws.com' && url.pathname.startsWith('/image.mpg/'))
    return url.protocol === 'https:' && officialAsset ? url.href : undefined
  } catch { return undefined }
}

async function readOfficial(url: string, kind: 'html' | 'json' = 'html', headers: Record<string, string> = {}): Promise<string> {
  const response = await fetch(url, { headers: { Accept: kind === 'json' ? 'application/json' : 'text/html', ...headers }, redirect: 'error', signal: AbortSignal.timeout(12_000) })
  const type = response.headers.get('content-type') || ''
  if (!response.ok || !type.includes(kind === 'json' ? 'application/json' : 'text/html') || Number(response.headers.get('content-length') || 0) > 4_000_000) throw new Error('Official coach information unavailable')
  const content = await response.text()
  if (content.length > 4_000_000) throw new Error('Official page too large')
  return content
}

function angularState(html: string): ObjectRecord {
  const data = html.match(/<script[^>]*id="(?:serverApp-state|ng-state)"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!data) throw new Error('Official club information unavailable')
  return object(JSON.parse(data))
}

function yearsOld(birth: unknown): number | undefined {
  if (typeof birth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return undefined
  const born = new Date(`${birth}T00:00:00Z`), today = new Date()
  if (!Number.isFinite(born.getTime()) || born > today) return undefined
  const birthdayPending = today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())
  const age = today.getUTCFullYear() - born.getUTCFullYear() - Number(birthdayPending)
  return age >= 18 && age <= 100 ? age : undefined
}

const slug = (name: string): string => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const htmlLabel = (value: string): string => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex: string, decimal: string) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10))).trim()

function payload(league: LeagueId, coaches: Coach[], message?: string): Coaches {
  const directory = directories[league]
  const sorted = coaches.sort((a, b) => a.club.localeCompare(b.club))
  return { coaches: sorted, source: directory.source, sourceUrl: directory.url, updatedAt: new Date().toISOString(), ...(message ? { message } : {}) }
}

async function premierCoaches(): Promise<Coaches> {
  // The official site uses its active season, rather than a historical API season fallback.
  const html = await readOfficial(directories.premier.url)
  const season = html.match(/ACTIVE_PL_SEASON_ID\s*=\s*['"](\d{4})['"]/)?.[1]
  if (!season) throw new Error('Active Premier League season unavailable')
  const data = object(JSON.parse(await readOfficial(`https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v1/competitions/8/seasons/${season}/managers?_limit=100`, 'json')))
  const coaches = array(data.data).map(object).flatMap((manager): Coach[] => {
    const team = object(manager.teamManaged), name = object(manager.name), dates = object(manager.dates), country = object(manager.country)
    const id = label(manager.id), clubId = label(team.id)
    // The feed contains previous managers, too. This is the official listing's current-coach filter.
    if (!/^\d+$/.test(id) || !/^\d+$/.test(clubId) || manager.activelyManaging !== team.id) return []
    const fullName = [label(name.first), label(name.last)].filter(Boolean).join(' '), club = label(team.name, team.shortName)
    if (!fullName || !club) return []
    return [{ id, name: fullName, club, clubId, clubLogo: `https://resources.premierleague.com/premierleague25/badges/${clubId}.svg`, photo: `https://resources.premierleague.com/premierleague25/photos/players/110x140/${id}.png`, nationality: label(country.country) || undefined, age: yearsOld(dates.birth), appointedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(dates.joinedClub)) ? String(dates.joinedClub) : undefined, profileUrl: `https://www.premierleague.com/en/managers/${id}/${slug(fullName)}/overview` }]
  })
  if (!coaches.length || new Set(coaches.map((coach) => coach.clubId)).size !== coaches.length) throw new Error('Current Premier League coaches unavailable')
  return payload('premier', coaches, coaches.length < directories.premier.clubs ? 'Some clubs do not currently have a confirmed coach in the official listing.' : undefined)
}

async function mapLimited<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      try { results[index] = { status: 'fulfilled', value: await run(items[index]) } }
      catch (reason) { results[index] = { status: 'rejected', reason } }
    }
  }))
  return results
}

async function bundesligaCoaches(): Promise<Coaches> {
  const state = angularState(await readOfficial(directories.bundesliga.url))
  const clubs = Object.values(state).map((value) => object(object(value).b)).map((body) => array(body.bundesliga)).find((items) => items.length > 0)?.map(object) || []
  if (clubs.length !== directories.bundesliga.clubs) throw new Error('Current Bundesliga clubs unavailable')
  const results = await mapLimited(clubs, async (club): Promise<Coach | undefined> => {
    const names = object(club.name), clubId = label(club.id), path = label(names.slugifiedFull)
    if (!/^DFL-CLU-[A-Z0-9]+$/.test(clubId) || !/^[a-z0-9-]+$/.test(path)) return undefined
    const profileUrl = `https://www.bundesliga.com/en/bundesliga/clubs/${path}/squad`
    const rosterState = angularState(await readOfficial(profileUrl))
    const roster = Object.values(rosterState).map((value) => object(object(value).b)).find((body) => object(body.roles).DL_HEAD_COACH)
    const managers = array(object(roster?.roles).DL_HEAD_COACH).map(object)
    // A current club roster explicitly identifies the head coach, unlike an old news article.
    if (managers.length !== 1) return undefined
    const manager = managers[0], name = object(manager.name), nationality = object(manager.nationality), images = object(manager.personImages)
    const id = label(manager.id), fullName = label(name.alias, name.full), clubName = label(names.full, names.small)
    if (!id || !fullName || !clubName) return undefined
    const logo = array(club.logos).map(object).find((image) => image.id === 'standard')
    return { id, name: fullName, club: clubName, clubId, clubLogo: safeImage(logo?.uri), photo: safeImage(images.FACE_CIRCLE), nationality: label(nationality.firstNationality) || undefined, profileUrl }
  })
  const coaches = results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
  if (!coaches.length) throw new Error('Current Bundesliga coaches unavailable')
  return payload('bundesliga', coaches, coaches.length < clubs.length ? `Official coach details are available for ${coaches.length} of ${clubs.length} clubs. Other club rosters could not be loaded.` : undefined)
}

async function laLigaCoaches(): Promise<Coaches> {
  const html = await readOfficial(directories.laliga.url)
  const data = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!data) throw new Error('Current LALIGA clubs unavailable')
  const next = object(JSON.parse(data)), props = object(object(next.props).pageProps), runtime = object(next.runtimeConfig)
  const clubs = array(props.teams).map(object), season = label(props.season), currentSeason = label(runtime.currentSeason)
  // This public configuration is used by LALIGA's own browser squad component.
  // Its subscription value stays server-side and is discovered afresh, never hardcoded.
  const apiBase = label(runtime.backendUrl), publicSubscription = label(runtime.backendSubscription)
  if (clubs.length !== directories.laliga.clubs || !/^20\d{2}$/.test(season) || currentSeason !== season || apiBase !== 'https://apim.laliga.com/public-service' || !publicSubscription) throw new Error('Current LALIGA roster configuration unavailable')
  const results = await mapLimited(clubs, async (club): Promise<Coach | undefined> => {
    const path = label(club.slug)
    if (!/^[a-z0-9-]+$/.test(path)) return undefined
    const response = object(JSON.parse(await readOfficial(`${apiBase}/api/v1/teams/${path}/squad-manager?seasonYear=${season}&limit=50&offset=0`, 'json', { 'Ocp-Apim-Subscription-Key': publicSubscription, 'Content-Language': 'en' })))
    const managers = array(response.squads).map(object).filter((entry) => entry.current === true && object(entry.role).slug === 'entrenador' && object(entry.position).slug === 'entrenador')
    if (managers.length !== 1) return undefined
    const manager = managers[0], person = object(manager.person), photos = object(object(manager.photos)['001']), country = object(person.country)
    const name = label(person.name), id = String(person.id || ''), clubId = String(club.id || ''), clubName = label(club.nickname, club.name)
    if (!name || !/^\d+$/.test(id) || !/^\d+$/.test(clubId) || !clubName) return undefined
    const countryId = label(country.id)
    let nationality: string | undefined
    if (/^[A-Z]{2}$/.test(countryId)) { try { nationality = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryId) } catch { /* The official country code is not a valid region. */ } }
    const birth = label(person.date_of_birth).slice(0, 10)
    return { id, name, club: clubName, clubId, clubLogo: safeImage(object(club.shield).url), photo: safeImage(photos['256x278'] || photos['128x139']), nationality, age: yearsOld(birth), profileUrl: `https://www.laliga.com/en-GB/clubs/${path}/squad` }
  })
  const coaches = results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
  if (!coaches.length) throw new Error('Current LALIGA coaches unavailable')
  return payload('laliga', coaches, coaches.length < clubs.length ? `Official coach details are available for ${coaches.length} of ${clubs.length} clubs. Other club rosters could not be loaded.` : undefined)
}

async function serieACoaches(): Promise<Coaches> {
  const html = await readOfficial(directories['serie-a'].url)
  const paths = [...new Set([...html.matchAll(/href="https:\/\/www\.legaseriea\.it(\/team\/[a-z0-9-]+\/)"/g)].map((match) => match[1]))]
  if (paths.length !== directories['serie-a'].clubs) throw new Error('Current Serie A clubs unavailable')
  const results = await mapLimited(paths, async (path): Promise<Coach | undefined> => {
    const profileUrl = `https://www.legaseriea.it${path.replace(/\/$/, '')}`
    const page = await readOfficial(profileUrl)
    // Read the club's live header rather than coach mentions in old news beneath it.
    const heading = page.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)
    if (!heading || heading.index === undefined) return undefined
    const header = page.slice(heading.index + heading[0].length, heading.index + heading[0].length + 1800)
    const name = htmlLabel(header.match(/<div\b[^>]*>(?:Allenatore|Coach)<\/div>\s*<div\b[^>]*>([^<]+)<\/div>/)?.[1] || '')
    const club = htmlLabel(heading[1]), clubSlug = path.split('/')[2]
    if (!name || !club || name === '-') return undefined
    const clubLogo = page.slice(Math.max(0, heading.index - 2500), heading.index).match(/src="(https:\/\/media-sdp\.legaseriea\.it\/clubLogos\/[^" ]+)"/)?.[1]
    return { id: `serie-a-${clubSlug}-${slug(name)}`, name, club, clubId: clubSlug, clubLogo: safeImage(clubLogo), profileUrl }
  })
  const coaches = results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
  if (!coaches.length) throw new Error('Current Serie A coaches unavailable')
  return payload('serie-a', coaches, coaches.length < paths.length ? `Official coach details are available for ${coaches.length} of ${paths.length} clubs. Other club pages could not be loaded.` : undefined)
}

async function ligue1Coaches(): Promise<Coaches> {
  // The league website's public club feed includes the current manager directly.
  const response = object(JSON.parse(await readOfficial('https://ma-api.ligue1.fr/championship-clubs', 'json', { application: 'ligue1', language: 'en', platform: 'web' })))
  const clubs = Object.values(object(response.championshipsClubs)).map(object).filter((club) => object(object(club.championships)['1']).active === 1)
  const seasons = clubs.map((club) => Number(club.season))
  if (clubs.length !== directories['ligue-1'].clubs || seasons.some((season) => !Number.isInteger(season) || season !== seasons[0])) throw new Error('Current Ligue 1 clubs unavailable')
  const coaches = clubs.flatMap((club): Coach[] => {
    const manager = object(club.manager), name = label(manager.knownName) || [label(manager.firstName), label(manager.lastName)].filter(Boolean).join(' ')
    const clubName = label(club.name, club.officialName), clubId = label(club.id), championship = object(object(club.championships)['1']), logo = object(object(championship.assets).logo)
    if (!name || !clubName || !/^l1_championship_club_\d{4}_\d+$/.test(clubId)) return []
    const countryUrl = label(manager.countryImageUrl)
    const countryCode = countryUrl.match(/^https:\/\/s3\.eu-west-1\.amazonaws\.com\/image\.mpg\/([a-z-]+)\.png$/)?.[1]
    let nationality: string | undefined
    const britishRegions: Record<string, string> = { 'gb-eng': 'England', 'gb-sct': 'Scotland', 'gb-wls': 'Wales', 'gb-nir': 'Northern Ireland' }
    if (countryCode && britishRegions[countryCode]) nationality = britishRegions[countryCode]
    else if (countryCode && /^[a-z]{2}$/.test(countryCode)) { try { nationality = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase()) } catch { /* Invalid official country code. */ } }
    // The feed does not provide coach portraits or birth/appointment dates.
    // Leave those optional fields empty rather than borrowing a player's photo.
    let profileUrl: string | undefined
    try { const website = new URL(label(club.websiteLink)); if (website.protocol === 'https:' && !website.username && !website.password) profileUrl = website.href } catch { /* No valid official club website. */ }
    return [{ id: `${clubId}-${slug(name)}`, name, club: clubName, clubId, clubLogo: safeImage(logo.medium || logo.small), nationality, profileUrl }]
  })
  if (!coaches.length) throw new Error('Current Ligue 1 coaches unavailable')
  return payload('ligue-1', coaches, coaches.length < clubs.length ? `Official coach details are available for ${coaches.length} of ${clubs.length} clubs.` : undefined)
}

export function leagueCoachesProxy(_apiKey: string) {
  // Public official sources do not consume the API-Football daily quota.
  const cache = new Map<LeagueId, { expiresAt: number; value: Coaches }>()
  const pending = new Map<LeagueId, Promise<Coaches>>()
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname !== '/') { next(); return }
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'Use GET to view team coaches.' })); return }
    const league = url.searchParams.get('league')
    if (!league || !Object.prototype.hasOwnProperty.call(directories, league)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid league.' })); return }
    const origin = req.headers.origin
    if (origin && req.headers.host) {
      try { if (new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' })); return } }
      catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Invalid request origin.' })); return }
    }
    const id = league as LeagueId
    let cached = cache.get(id)
    if (!cached || cached.expiresAt <= Date.now()) {
      let request = pending.get(id)
      if (!request) {
        request = (id === 'premier' ? premierCoaches() : id === 'bundesliga' ? bundesligaCoaches() : id === 'laliga' ? laLigaCoaches() : id === 'serie-a' ? serieACoaches() : ligue1Coaches())
          .catch(() => ({ ...payload(id, []), error: 'Current coach details are unavailable from the official league source. Open the official club directory to view team information.' }))
          .then((value) => { cache.set(id, { expiresAt: Date.now() + (value.coaches.length ? 6 * 60 * 60_000 : 15 * 60_000), value }); return value })
          .finally(() => { pending.delete(id) })
        pending.set(id, request)
      }
      await request
      cached = cache.get(id)
    }
    if (!cached) { res.statusCode = 502; res.end(JSON.stringify({ ...payload(id, []), error: 'The official coaches listing is temporarily unavailable.' })); return }
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.end(JSON.stringify(cached.value))
  }
  return { name: 'official-league-coaches-proxy', configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/league-coaches', middleware) }, configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/league-coaches', middleware) } }
}
