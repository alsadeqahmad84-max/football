import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { matchClipLookupUrl, type MatchClip, type MatchClipResult } from './footballVideo'
import LeagueRankings from './LeagueRankings'
import LeagueCoaches, { type CoachRecord } from './LeagueCoaches'
import FootballHeroArt from './FootballHeroArt'
import { buildFplScorers, buildFplStandings, mapApiScorers, mapApiStandings, type ApiStanding, type ApiTopScorer } from './footballRankings'

type Match = { id: string; home: string; away: string; date: string; time: string; week: number; venue?: string; score?: [number, number]; status?: string; difficulty?: [number, number]; pulseId?: number; apiFixtureId?: number; homeLogo?: string; awayLogo?: string }
type StadiumPhoto = { image: string; page: string; credit?: string; license?: string }
type StadiumCommonsImageInfo = { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }
type StadiumCommonsPage = { title?: string; imageinfo?: StadiumCommonsImageInfo[] }
type StadiumCommonsPages = { query?: { pages?: Record<string, StadiumCommonsPage> } }
type League = { id: string; name: string; country: string; clubs: number; matchdays: number; mark: string; logo: string; officialUrl: string; accent: string; apiId?: number }
type MatchReportPlayer = { name: string; shirtNumber?: string; position?: string; photo?: string }
type MatchReport = { goals: { side: 'home' | 'away'; minute: string; scorer: string; assist?: string }[]; homeStarters: MatchReportPlayer[]; awayStarters: MatchReportPlayer[]; homeBench?: MatchReportPlayer[]; awayBench?: MatchReportPlayer[]; benchAvailable?: boolean; eventsAvailable: boolean; lineupsAvailable: boolean }
type FplPlayer = { id: number; web_name: string; first_name?: string; second_name?: string; photo?: string; team: number; element_type: number; now_cost: number; total_points: number; minutes: number; goals_scored?: number; assists?: number; form: string; points_per_game: string; selected_by_percent: string; expected_goal_involvements?: string; status: string; news?: string; chance_of_playing_next_round?: number | null; ep_next?: string | null }
type FplTeam = { id: number; name: string; short_name: string; code: number }
type FplEvent = { id: number; name: string; is_current: boolean; is_next: boolean; finished: boolean }
type FplBoot = { elements: FplPlayer[]; teams: FplTeam[]; events: FplEvent[]; element_types: { id: number; singular_name: string }[] }
type FplFixtureStat = { identifier: string; h: { element: number; value: number }[]; a: { element: number; value: number }[] }
type FplFixture = { id: number; code?: number; pulse_id?: number; event: number | null; team_h: number; team_a: number; kickoff_time: string | null; finished: boolean; started: boolean; minutes: number; team_h_score: number | null; team_a_score: number | null; team_h_difficulty: number; team_a_difficulty: number; stats?: FplFixtureStat[] }
type AuditEntry = { id: number; timestamp: string; action: string; detail: string }
type CloudStats = { cpu: number; memory: number; latency: number; requests: number; uptime: number }
type Outcome = { home: number; draw: number; away: number }
type ApiFootballFixture = { fixture: { id: number; date: string; status: { short: string; elapsed?: number | null }; venue?: { name?: string | null } }; league: { round: string }; teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } }; goals: { home: number | null; away: number | null } }
type ApiFootballPayload<T> = { response?: T[]; errors?: unknown }
type ApiFootballStanding = ApiStanding
type ApiFootballStandingsPayload = { response?: { league?: { standings?: ApiFootballStanding[][] } }[]; errors?: unknown }
type ApiFootballReportPlayer = { id?: number; name?: string; number?: number; pos?: string }
type ApiFootballReportSide = { team?: { name?: string }; startXI?: { player?: ApiFootballReportPlayer }[]; substitutes?: { player?: ApiFootballReportPlayer }[] }
type ApiFootballEvent = { time?: { elapsed?: number | null; extra?: number | null }; team?: { name?: string }; player?: { name?: string }; assist?: { name?: string }; type?: string; detail?: string }
type ApiFootballDetailedFixture = { events?: ApiFootballEvent[]; lineups?: ApiFootballReportSide[] }

const leagues: League[] = [
  { id: 'premier', name: 'Premier League', country: 'England', clubs: 20, matchdays: 38, mark: 'PL', logo: '/premier-league-lion.png', officialUrl: 'https://www.premierleague.com/', accent: '#6c3ca0' },
  { id: 'laliga', name: 'LALIGA EA SPORTS', country: 'Spain', clubs: 20, matchdays: 38, mark: 'LALIGA', logo: 'https://media.api-sports.io/football/leagues/140.png', officialUrl: 'https://www.laliga.com/en-GB', accent: '#ee3e54', apiId: 140 },
  { id: 'serie-a', name: 'Serie A', country: 'Italy', clubs: 20, matchdays: 38, mark: 'A', logo: 'https://media.api-sports.io/football/leagues/135.png', officialUrl: 'https://en.legaseriea.it/', accent: '#1476c8', apiId: 135 },
  { id: 'bundesliga', name: 'Bundesliga', country: 'Germany', clubs: 18, matchdays: 34, mark: 'BL', logo: 'https://media.api-sports.io/football/leagues/78.png', officialUrl: 'https://www.bundesliga.com/en/bundesliga', accent: '#d71920', apiId: 78 },
  { id: 'ligue-1', name: 'Ligue 1 McDonald’s', country: 'France', clubs: 18, matchdays: 34, mark: 'L1', logo: 'https://media.api-sports.io/football/leagues/61.png', officialUrl: 'https://ligue1.com/en', accent: '#223e92', apiId: 61 },
]

const ratings: Record<string, number> = { Arsenal: 88, 'Man City': 91, Liverpool: 87, Chelsea: 82, 'Man Utd': 80, Newcastle: 81, 'Aston Villa': 79, Brighton: 78, Spurs: 79, Brentford: 75, Everton: 73, 'Crystal Palace': 74, Fulham: 72, 'Nott Forest': 73, 'AFC Bournemouth': 74, Leeds: 71, Sunderland: 68, Ipswich: 70, 'Hull City': 69, Coventry: 70 }
const fixtureData: Match[] = [
  { id: 'a-leeds', home: 'Arsenal', away: 'Leeds', date: '2026-10-10', time: '12:30', week: 6 },
  { id: 'villa-brentford', home: 'Aston Villa', away: 'Brentford', date: '2026-10-10', time: '15:00', week: 6 },
  { id: 'chelsea-bournemouth', home: 'Chelsea', away: 'AFC Bournemouth', date: '2026-10-10', time: '15:00', week: 6 },
  { id: 'ipswich-fulham', home: 'Ipswich', away: 'Fulham', date: '2026-10-10', time: '15:00', week: 6 },
  { id: 'sunderland-brighton', home: 'Sunderland', away: 'Brighton', date: '2026-10-10', time: '15:00', week: 6 },
  { id: 'united-spurs', home: 'Man Utd', away: 'Spurs', date: '2026-10-10', time: '17:30', week: 6 },
  { id: 'palace-forest', home: 'Crystal Palace', away: 'Nott Forest', date: '2026-10-11', time: '14:00', week: 6 },
  { id: 'hull-everton', home: 'Hull City', away: 'Everton', date: '2026-10-11', time: '14:00', week: 6 },
  { id: 'liverpool-city', home: 'Liverpool', away: 'Man City', date: '2026-10-11', time: '16:30', week: 6 },
  { id: 'coventry-newcastle', home: 'Coventry', away: 'Newcastle', date: '2026-10-12', time: '20:00', week: 6 },
  { id: 'everton-chelsea', home: 'Everton', away: 'Chelsea', date: '2026-10-17', time: '12:30', week: 7 },
  { id: 'brentford-liverpool', home: 'Brentford', away: 'Liverpool', date: '2026-10-17', time: '15:00', week: 7 },
  { id: 'fulham-hull', home: 'Fulham', away: 'Hull City', date: '2026-10-17', time: '15:00', week: 7 },
  { id: 'city-ipswich', home: 'Man City', away: 'Ipswich', date: '2026-10-17', time: '15:00', week: 7 },
  { id: 'newcastle-villa', home: 'Newcastle', away: 'Aston Villa', date: '2026-10-17', time: '17:30', week: 7 },
  { id: 'bournemouth-sunderland', home: 'AFC Bournemouth', away: 'Sunderland', date: '2026-10-18', time: '14:00', week: 7 },
  { id: 'brighton-palace', home: 'Brighton', away: 'Crystal Palace', date: '2026-10-18', time: '14:00', week: 7 },
  { id: 'leeds-united', home: 'Leeds', away: 'Man Utd', date: '2026-10-18', time: '14:00', week: 7 },
  { id: 'forest-arsenal', home: 'Nott Forest', away: 'Arsenal', date: '2026-10-18', time: '16:30', week: 7 },
  { id: 'spurs-coventry', home: 'Spurs', away: 'Coventry', date: '2026-10-19', time: '20:00', week: 7 },
]
const results: Match[] = [
  { id: 'result-brentford-chelsea', home: 'Brentford', away: 'Chelsea', date: '2026-09-18', time: 'FT', week: 5, score: [3, 0] },
  { id: 'result-spurs-villa', home: 'Spurs', away: 'Aston Villa', date: '2026-09-19', time: 'FT', week: 5, score: [2, 3] },
  { id: 'result-brighton-arsenal', home: 'Brighton', away: 'Arsenal', date: '2026-09-19', time: 'FT', week: 5, score: [3, 0] },
]
const clubBadgeIds: Record<string, number> = { Arsenal: 3, 'Aston Villa': 7, 'AFC Bournemouth': 91, Brentford: 94, Brighton: 36, Chelsea: 8, 'Crystal Palace': 31, Everton: 11, Fulham: 54, 'Hull City': 89, Ipswich: 41, Leeds: 2, Liverpool: 14, 'Man City': 43, 'Man Utd': 1, Newcastle: 4, 'Nott Forest': 17, Sunderland: 56, Spurs: 6, Coventry: 10 }
const clubBadgeOverrides: Record<string, string> = { Coventry: '/coventry-city.png', 'Coventry City': '/coventry-city.png', 'AFC Bournemouth': '/afc-bournemouth.png', Bournemouth: '/afc-bournemouth.png', 'Hull City': '/hull-city.png', Ipswich: '/ipswich-town.png', 'Ipswich Town': '/ipswich-town.png', 'Nott Forest': '/nottingham-forest.png', "Nott'm Forest": '/nottingham-forest.png', 'Nottingham Forest': '/nottingham-forest.png' }
const crestColors: Record<string, string> = { Arsenal: '#e94350', 'Man City': '#73c7e8', Liverpool: '#dc3345', Chelsea: '#3975dc', 'Man Utd': '#e84c4c', Newcastle: '#52576a', 'Aston Villa': '#9b6bc4', Brighton: '#4888ee', Spurs: '#556887', Brentford: '#e74b52', Everton: '#486de0', 'Crystal Palace': '#665bd1', Fulham: '#7a828f', 'Nott Forest': '#e15360', 'AFC Bournemouth': '#ec5853', Leeds: '#d1ae48', Sunderland: '#de5257', Ipswich: '#4783e7', 'Hull City': '#e59343', Coventry: '#5489ef' }
const stadiumByClub: Record<string, string> = { Arsenal: 'Emirates Stadium', 'Aston Villa': 'Villa Park', 'AFC Bournemouth': 'Vitality Stadium', Bournemouth: 'Vitality Stadium', Brentford: 'Gtech Community Stadium', Brighton: 'Amex Stadium', Chelsea: 'Stamford Bridge', Coventry: 'Coventry Building Society Arena', 'Coventry City': 'Coventry Building Society Arena', 'Crystal Palace': 'Selhurst Park', Everton: 'Hill Dickinson Stadium', Fulham: 'Craven Cottage', 'Hull City': 'MKM Stadium', Ipswich: 'Portman Road', 'Ipswich Town': 'Portman Road', Leeds: 'Elland Road', 'Leeds United': 'Elland Road', Liverpool: 'Anfield', 'Man City': 'Etihad Stadium', 'Manchester City': 'Etihad Stadium', 'Man Utd': 'Old Trafford', 'Manchester United': 'Old Trafford', Newcastle: "St James' Park", 'Nott Forest': 'The City Ground', "Nott'm Forest": 'The City Ground', 'Nottingham Forest': 'The City Ground', Sunderland: 'Stadium of Light', Spurs: 'Tottenham Hotspur Stadium', 'Tottenham Hotspur': 'Tottenham Hotspur Stadium' }
async function findStadiumPhoto(venue: string, signal: AbortSignal): Promise<StadiumPhoto | null> {
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  api.searchParams.set('action', 'query'); api.searchParams.set('format', 'json'); api.searchParams.set('origin', '*')
  api.searchParams.set('generator', 'search'); api.searchParams.set('gsrnamespace', '6'); api.searchParams.set('gsrsearch', `"${venue}" stadium`); api.searchParams.set('gsrlimit', '8')
  api.searchParams.set('prop', 'imageinfo'); api.searchParams.set('iiprop', 'url|extmetadata'); api.searchParams.set('iiurlwidth', '1400')
  const response = await fetch(api, { signal })
  if (!response.ok) return null
  const data = await response.json() as StadiumCommonsPages
  const venueWords = venue.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !['stadium', 'park', 'ground', 'arena'].includes(word))
  const results = Object.values(data.query?.pages || {}).map((page) => {
    const image = page.imageinfo?.[0], title = (page.title || '').toLowerCase()
    return { page, image, score: venueWords.reduce((total, word) => total + Number(title.includes(word)), 0) }
  }).filter(({ page, image, score }) => score > 0 && /^File:.*\.(jpe?g|png|webp)$/i.test(page.title || '') && image && /^https:\/\/upload\.wikimedia\.org\//.test(image.thumburl || image.url || '')).sort((a, b) => b.score - a.score)
  const match = results[0]
  if (!match?.image) return null
  const meta = match.image.extmetadata || {}
  const clean = (value?: string) => value?.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').trim().slice(0, 160)
  return { image: match.image.thumburl || match.image.url!, page: match.image.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(match.page.title || '')}`, credit: clean(meta.Artist?.value || meta.Credit?.value), license: clean(meta.LicenseShortName?.value) }
}
const scorecardColors: Record<string, string> = { Arsenal: '#e5091c', Coventry: '#00a6ce', 'Coventry City': '#00a6ce', 'Aston Villa': '#7a1234', 'AFC Bournemouth': '#d71920', Bournemouth: '#d71920', Brentford: '#e30613', Brighton: '#0057b8', Chelsea: '#034694', 'Crystal Palace': '#1b458f', Everton: '#003399', Fulham: '#171717', 'Hull City': '#ee8b00', Ipswich: '#005a9c', 'Ipswich Town': '#005a9c', Leeds: '#f4c400', 'Leeds United': '#f4c400', Liverpool: '#c8102e', 'Man City': '#6caddf', 'Manchester City': '#6caddf', 'Man Utd': '#da291c', 'Manchester United': '#da291c', Newcastle: '#241f20', 'Nott Forest': '#e21b2d', "Nott'm Forest": '#e21b2d', 'Nottingham Forest': '#e21b2d', Sunderland: '#eb172b', Spurs: '#132257', 'Tottenham Hotspur': '#132257' }

function probabilities(match: Match): Outcome {
  const home = ratings[match.home] ?? 71
  const away = ratings[match.away] ?? 71
  const expectedHome = 1 / (1 + 10 ** (-(home + 58 - away) / 360))
  const draw = Math.round(Math.max(18, Math.min(32, 30 - Math.abs(home + 58 - away) / 15)))
  const homePct = Math.round((1 - draw / 100) * expectedHome * 100)
  return { home: homePct, draw, away: 100 - homePct - draw }
}
function coachNameFor(team: string, coaches: CoachRecord[]) {
  const aliases: Record<string, string> = { manutd: 'manchesterunited', mancity: 'manchestercity', nottmforest: 'nottinghamforest', spurs: 'tottenhamhotspur', wolves: 'wolverhamptonwanderers', brighton: 'brightonandhovealbion', westham: 'westhamunited', newcastle: 'newcastleunited', leeds: 'leedsunited', bournemouth: 'afcbournemouth' }
  const key = (name: string) => { const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); return aliases[normalized] || normalized }
  return coaches.find((coach) => key(coach.club) === key(team))?.name
}
function clubDate(value: string) { return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`)) }
function clubLongDate(value: string) { return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }
function jordanKickoff(instant: Date) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hour12: false }).format(instant) }
function ukKickoffInJordan(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute)
  const londonTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utcGuess))
  const londonHour = Number(londonTime.find((part) => part.type === 'hour')?.value || 0)
  const londonMinute = Number(londonTime.find((part) => part.type === 'minute')?.value || 0)
  const londonOffset = Date.UTC(year, month - 1, day, londonHour, londonMinute) - utcGuess
  return jordanKickoff(new Date(utcGuess - londonOffset))
}
function ClubMark({ name, size = 'normal', image }: { name: string; size?: 'normal' | 'large'; image?: string }) {
  const [failed, setFailed] = useState(false)
  const badgeId = clubBadgeIds[name]
  const badgeSource = image || (clubBadgeOverrides[name] ? `${clubBadgeOverrides[name]}?v=crest-alpha-2` : badgeId ? `https://resources.premierleague.com/premierleague/badges/50/t${badgeId}@x2.png` : undefined)
  return <span className={`club-mark ${size}`} style={{ '--club': crestColors[name] || '#8458ca' } as CSSProperties} aria-hidden="true">
    {badgeSource && !failed ? <img src={badgeSource} alt="" onError={() => setFailed(true)} /> : name.split(' ').map((part) => part[0]).join('').slice(0, 3)}
  </span>
}
function mapApiFixture(item: ApiFootballFixture): Match | null {
  const fixture = item.fixture
  const home = item.teams?.home
  const away = item.teams?.away
  if (!fixture?.id || !fixture.date || !home?.name || !away?.name) return null
  const kickoff = new Date(fixture.date)
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(kickoff)
  const round = Number(item.league?.round?.match(/(\d+)\s*$/)?.[1] || 1)
  const apiStatus = fixture.status?.short || ''
  const score = item.goals?.home !== null && item.goals?.home !== undefined && item.goals?.away !== null && item.goals?.away !== undefined ? [item.goals.home, item.goals.away] as [number, number] : undefined
  const status = apiStatus === 'NS' ? undefined : ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(apiStatus) ? (apiStatus === 'FT' || apiStatus === 'AET' || apiStatus === 'PEN' ? 'FT' : apiStatus) : fixture.status?.elapsed ? `${fixture.status.elapsed}′` : apiStatus || undefined
  return { id: `api-${fixture.id}`, apiFixtureId: fixture.id, home: home.name, away: away.name, homeLogo: home.logo, awayLogo: away.logo, venue: fixture.venue?.name || undefined, date: localDate, time: jordanKickoff(kickoff), week: round, score, status }
}
function mapApiReport(payload: ApiFootballPayload<ApiFootballDetailedFixture>, home: string, away: string): MatchReport {
  const data = payload.response?.[0]
  const sides = data?.lineups || []
  const sideFor = (teamName: string) => sides.find((side) => side.team?.name === teamName)
  const toPlayers = (items: ApiFootballReportSide['startXI'] = []): MatchReportPlayer[] => (items || []).flatMap(({ player }) => {
    if (!player?.name) return []
    const positions: Record<string, string> = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward' }
    return [{ name: player.name, ...(player.number !== undefined ? { shirtNumber: String(player.number) } : {}), ...(player.pos ? { position: positions[player.pos] || player.pos } : {}), ...(player.id ? { photo: `https://media.api-sports.io/football/players/${player.id}.png` } : {}) }]
  })
  const homeSide = sideFor(home)
  const awaySide = sideFor(away)
  const goals = (data?.events || []).flatMap((event): MatchReport['goals'] => {
    if (!event.type?.toLowerCase().includes('goal') || !event.team?.name || !event.player?.name) return []
    const side = event.team.name === home ? 'home' : event.team.name === away ? 'away' : null
    if (!side) return []
    const minute = `${event.time?.elapsed ?? '?'}${event.time?.extra ? `+${event.time.extra}` : ''}`
    return [{ side, minute, scorer: event.player.name, ...(event.assist?.name ? { assist: event.assist.name } : {}) }]
  })
  return { goals, homeStarters: toPlayers(homeSide?.startXI), awayStarters: toPlayers(awaySide?.startXI), homeBench: toPlayers(homeSide?.substitutes), awayBench: toPlayers(awaySide?.substitutes), benchAvailable: Boolean(homeSide?.substitutes || awaySide?.substitutes), eventsAvailable: Boolean(data?.events), lineupsAvailable: Boolean(homeSide?.startXI?.length || awaySide?.startXI?.length) }
}
function LeagueMark({ league, className = '' }: { league: League; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <span className={`pl-league-mark ${className}`} style={{ '--league-accent': league.accent } as CSSProperties} aria-hidden="true">
    {!failed ? <img src={league.logo} alt="" onError={() => setFailed(true)} /> : <b>{league.mark}</b>}
  </span>
}
function Glyph({ name }: { name: 'grid' | 'calendar' | 'chart' | 'search' | 'chevron' | 'arrow' | 'ball' | 'clock' | 'external' | 'star' | 'info' | 'cloud' | 'mic' }) {
  const path: Record<typeof name, string> = { grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z', calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z', chart: 'M3 3v18h18 M7 14l4-4 4 3 6-8', search: 'm20 20-4.2-4.2 M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z', chevron: 'm9 18 6-6-6-6', arrow: 'M7 17 17 7 M7 7h10v10', ball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 2l2.5 6.2 6.6.3-5.1 4.2 1.8 6.3-5.8-3.6-5.8 3.6 1.8-6.3-5.1-4.2 6.6-.3z', clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', external: 'M14 3h7v7 M10 14 21 3 M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6', star: 'm12 3 2.7 5.7 6.3.9-4.5 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9z', info: 'M12 11v5m0-9h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', cloud: 'M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.6 1.8A4 4 0 0 0 7 17h12', mic: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v1a7 7 0 0 1-14 0v-1 M12 18v4m-4 0h8' }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path[name]} /></svg>
}
function SoccerBallGlyph() {
  return <img className="pl-nav-football" src="/view-goal-football.webp" width="28" height="28" alt="" aria-hidden="true" />
}
function CoachGlyph() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4h4v12h-4M17 8h2M17 12h2"/></svg>
}
function PlayMark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 4 12 8-12 8z"/></svg>
}
function MatchHighlightCard({ match, goals, onPlay, onFantasy, fantasyAvailable }: { match: Match; goals: { goal: MatchReport['goals'][number]; scoreAtGoal: [number, number] }[]; onPlay: (clip: MatchClip, match: Match) => void; onFantasy: (match: Match) => void; fantasyAvailable: boolean }) {
  const [clip, setClip] = useState<MatchClip | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const lookupUrl = matchClipLookupUrl(match)
  useEffect(() => {
    const controller = new AbortController()
    setClip(null); setLoading(true); setMessage('')
    void fetch(lookupUrl, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Clip lookup unavailable')
      return await response.json() as MatchClipResult
    }).then((result) => {
      if (controller.signal.aborted) return
      setClip(result.clip); setMessage(result.message || 'A verified clip is not available for this match yet.'); setLoading(false)
    }).catch(() => {
      if (!controller.signal.aborted) { setLoading(false); setMessage('The video provider could not be reached. Please try again later.') }
    })
    return () => controller.abort()
  }, [lookupUrl])
  function play() {
    if (!clip) return
    if (clip.embedUrl) onPlay(clip, match)
    else window.open(clip.url, '_blank', 'noopener,noreferrer')
  }
  const playLabel = `Watch ${match.home} versus ${match.away} goals${clip ? ` on ${clip.source}` : ''}`
  return <article className="pl-match-highlight-card">
    <button className="pl-match-highlight-preview" onClick={play} disabled={!clip} aria-label={playLabel}>
      {clip?.thumbnail ? <img src={clip.thumbnail} alt="" loading="lazy"/> : <span className="pl-clip-placeholder"><ClubMark name={match.home} image={match.homeLogo} size="large"/><ClubMark name={match.away} image={match.awayLogo} size="large"/></span>}
      <span className="pl-clip-play"><PlayMark/></span><span className="pl-clip-provider">{clip?.source || (loading ? 'Finding match clip…' : 'Clip unavailable')}</span>
      {clip?.duration && <span className="pl-clip-duration">{Math.floor(clip.duration / 60)}:{String(clip.duration % 60).padStart(2, '0')}</span>}
    </button>
    <button className="pl-match-highlight-teams" onClick={play} disabled={!clip} aria-label={playLabel}><span><ClubMark name={match.home} image={match.homeLogo}/><b>{match.home}</b></span><strong>{match.score?.[0]} <i>–</i> {match.score?.[1]}</strong><span><ClubMark name={match.away} image={match.awayLogo}/><b>{match.away}</b></span></button>
    <span className="pl-match-highlight-meta">{clubDate(match.date)} · {goals.length ? `${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}` : match.score?.every((value) => value === 0) ? 'No goals' : 'Full time'}</span>
    <div className="pl-highlight-goal-columns">{(['home', 'away'] as const).map((side, sideIndex) => {
      const clubName = side === 'home' ? match.home : match.away
      const clubGoals = goals.filter(({ goal }) => goal.side === side)
      const goalCount = match.score?.[sideIndex] ?? clubGoals.length
      return <section className={`pl-highlight-club-goals ${side}`} key={side} aria-label={`${clubName} goals`}>
        <h4><span>{clubName}</span><small>{goalCount} {goalCount === 1 ? 'goal' : 'goals'}</small></h4>
        {clubGoals.length ? <ol>{clubGoals.map(({ goal, scoreAtGoal }, goalIndex) => <li className="pl-highlight-club-goal" key={`${goal.minute}-${goal.scorer}-${goalIndex}`}><time>{goal.minute.replace(/[′’']/g, '')}′</time><small aria-label={`Score after this goal: ${match.home} ${scoreAtGoal[0]}, ${match.away} ${scoreAtGoal[1]}`}>{scoreAtGoal[0]}–{scoreAtGoal[1]}</small><b>{goal.scorer}</b></li>)}</ol> : <p className="pl-highlight-club-goals-empty">{goalCount === 0 ? 'No goals' : 'Goal details unavailable'}</p>}
      </section>
    })}</div>
    <div className="pl-clip-actions"><button className="pl-watch-clip" onClick={play} disabled={!clip}><PlayMark/>{loading ? 'Finding clip…' : clip ? 'Watch goals' : 'Clip unavailable'}</button>{fantasyAvailable && <button className="pl-fantasy-match-action" onClick={() => onFantasy(match)}><Glyph name="chart"/>Fantasy stats</button>}</div>
    {!loading && !clip && <small className="pl-clip-unavailable" role="status">{message}</small>}
  </article>
}
function MediaDialog({ children, titleId, onClose, className = '' }: { children: ReactNode; titleId: string; onClose: () => void; className?: string }) {
  const panel = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], iframe, [tabindex="0"]') || [])
      const first = items[0]; const last = items[items.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus() }
  }, [])
  return <div className="pl-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`pl-media-modal ${className}`} ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}><button className="pl-modal-close" aria-label="Close match viewer" onClick={onClose}>×</button>{children}</section></div>
}
function MatchClipPlayer({ clip, match, onClose, onFantasy }: { clip: MatchClip; match: Match; onClose: () => void; onFantasy?: () => void }) {
  return <MediaDialog titleId="pl-clip-title" onClose={onClose}><header><span className="pl-section-kicker">{clip.source} · MATCH HIGHLIGHTS</span><h2 id="pl-clip-title">{match.home} <span>v</span> {match.away}</h2><p>{clubLongDate(match.date)} · All match goals and highlights</p></header><div className="pl-match-video"><iframe src={clip.embedUrl} title={clip.title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div><div className="pl-media-actions"><a href={clip.sourceUrl || clip.url} target="_blank" rel="noopener noreferrer">Open original clip <Glyph name="external"/></a>{onFantasy && <button onClick={onFantasy}><Glyph name="chart"/>Fantasy stats</button>}</div><p className="pl-media-note">This is the selected match’s official highlights clip. Playback, adverts and regional availability are controlled by {clip.source}.</p></MediaDialog>
}
function FantasyMatchPanel({ match, fixture, players, onClose }: { match: Match; fixture: FplFixture; players: FplPlayer[]; onClose: () => void }) {
  const playerName = (id: number) => { const player = players.find((item) => item.id === id); return player ? [player.first_name, player.second_name].filter(Boolean).join(' ') || player.web_name : `Player ${id}` }
  const labels: Record<string, string> = { goals_scored: 'Goals scored', assists: 'Assists', own_goals: 'Own goals', penalties_saved: 'Penalties saved', penalties_missed: 'Penalties missed', yellow_cards: 'Yellow cards', red_cards: 'Red cards', saves: 'Saves', bonus: 'Bonus points', bps: 'Bonus Points System', defensive_contribution: 'Defensive contribution' }
  const stats = (fixture.stats || []).filter((stat) => stat.h.length || stat.a.length)
  return <MediaDialog titleId="pl-fantasy-match-title" onClose={onClose} className="pl-fantasy-match-modal"><header><span className="pl-section-kicker">FANTASY PREMIER LEAGUE · MATCHWEEK {match.week}</span><h2 id="pl-fantasy-match-title">{match.home} <span>v</span> {match.away}</h2><p>{clubLongDate(match.date)} · Official Fantasy match stats</p></header><div className="pl-fantasy-match-score"><span><ClubMark name={match.home} image={match.homeLogo} size="large"/><b>{match.home}</b></span><strong>{match.score?.[0]} – {match.score?.[1]}</strong><span><ClubMark name={match.away} image={match.awayLogo} size="large"/><b>{match.away}</b></span></div><div className="pl-fantasy-match-stats">{stats.map((stat) => <section key={stat.identifier}><h3>{labels[stat.identifier] || stat.identifier.replace(/_/g, ' ')}</h3><div>{(['h', 'a'] as const).map((side) => <article key={side}><h4>{side === 'h' ? match.home : match.away}</h4>{stat[side].length ? stat[side].map((item) => <p key={item.element}><span>{playerName(item.element)}</span><b>{item.value}</b></p>) : <span className="pl-fantasy-no-stat">—</span>}</article>)}</div></section>)}</div>{!stats.length && <p className="pl-empty">Fantasy player stats have not been published for this match yet.</p>}<div className="pl-media-actions"><a href="https://fantasy.premierleague.com/en/fixtures" target="_blank" rel="noopener noreferrer">Open Fantasy fixtures <Glyph name="external"/></a></div></MediaDialog>
}

export default function PremierLeagueHub() {
  const [page, setPage] = useState<'overview' | 'fixtures' | 'predictions' | 'fantasy' | 'rankings' | 'coaches' | 'audit' | 'design' | 'cloud'>('overview')
  const [rankingsTab, setRankingsTab] = useState<'standings' | 'scorers'>('standings')
  const [rankingFeed, setRankingFeed] = useState<{ leagueId: string; loading: boolean; standings: ApiStanding[]; scorers: ApiTopScorer[]; standingsError?: string; scorersError?: string; updatedAt?: string; source?: string }>({ leagueId: '', loading: false, standings: [], scorers: [] })
  const [sectionWeek, setSectionWeek] = useState(6)
  const [goalWeek, setGoalWeek] = useState<number | null>(null)
  const [fpl, setFpl] = useState<FplBoot | null>(null)
  const [fplFixtures, setFplFixtures] = useState<FplFixture[]>([])
  const [fplError, setFplError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')
  const [jordanClock, setJordanClock] = useState(() => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()))
  const [positionFilter, setPositionFilter] = useState('All positions')
  const [maxPrice, setMaxPrice] = useState(15)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cloudRunning, setCloudRunning] = useState(false)
  const [cloudStats, setCloudStats] = useState<CloudStats>({ cpu: 18, memory: 42, latency: 84, requests: 0, uptime: 0 })
  const followCurrentWeek = useRef(true)
  const followLatestGoalWeek = useRef(false)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => { try { return JSON.parse(localStorage.getItem('plhub-audit-log') || '[]') as AuditEntry[] } catch { return [] } })
  const [club, setClub] = useState('All clubs')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Match | null>(null)
  const [stadiumPhoto, setStadiumPhoto] = useState<{ venue: string; photo: StadiumPhoto } | null>(null)
  const [activeLeagueId, setActiveLeagueId] = useState('premier')
  const [selectedClip, setSelectedClip] = useState<{ clip: MatchClip; match: Match } | null>(null)
  const [selectedFantasyMatch, setSelectedFantasyMatch] = useState<Match | null>(null)
  const [lineupCoaches, setLineupCoaches] = useState<CoachRecord[]>([])
  const [apiFixtures, setApiFixtures] = useState<Match[]>([])
  const [apiLeagueState, setApiLeagueState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [apiLeagueError, setApiLeagueError] = useState('')
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null)
  const [matchReportState, setMatchReportState] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle')
  const [goalReports, setGoalReports] = useState<Record<string, MatchReport>>({})
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('plhub-favorites') || '[]') as string[] } catch { return [] } })
  useEffect(() => {
    const venue = selected?.venue
    if (!venue) { setStadiumPhoto(null); return }
    const controller = new AbortController()
    setStadiumPhoto(null)
    void findStadiumPhoto(venue, controller.signal)
      .then((photo) => { if (!controller.signal.aborted && photo) setStadiumPhoto({ venue, photo }) })
      .catch(() => {})
    return () => controller.abort()
  }, [selected?.venue])
  const activeLeague = leagues.find((league) => league.id === activeLeagueId) || leagues[0]
  const teamById = useMemo(() => new Map((fpl?.teams || []).map((team) => [team.id, team])), [fpl])
  const liveMatches = useMemo<Match[]>(() => fplFixtures.filter((fixture) => fixture.event !== null && fixture.kickoff_time).map((fixture) => {
    const home = teamById.get(fixture.team_h)?.name || `Club ${fixture.team_h}`
    const away = teamById.get(fixture.team_a)?.name || `Club ${fixture.team_a}`
    const kickoff = new Date(fixture.kickoff_time!)
    const status = fixture.finished ? 'FT' : fixture.started ? (fixture.minutes ? `${fixture.minutes}′` : 'LIVE') : undefined
    return { id: `fpl-${fixture.id}`, pulseId: fixture.pulse_id || fixture.code || undefined, home, away, venue: stadiumByClub[home], date: kickoff.toISOString().slice(0, 10), time: jordanKickoff(kickoff), week: fixture.event!, score: fixture.finished || fixture.started ? [fixture.team_h_score ?? 0, fixture.team_a_score ?? 0] : undefined, status, difficulty: [fixture.team_h_difficulty, fixture.team_a_difficulty] }
  }), [fplFixtures, teamById])
  const activeFixtures = useMemo(() => activeLeague.id === 'premier' ? (liveMatches.length ? liveMatches : fixtureData.map((match) => ({ ...match, venue: stadiumByClub[match.home], time: ukKickoffInJordan(match.date, match.time) }))) : apiFixtures, [activeLeague.id, apiFixtures, liveMatches])
  const latestCompletedWeek = activeFixtures.reduce((latest, match) => match.score && (match.status === 'FT' || !match.status) ? Math.max(latest, match.week) : latest, 0)
  const latestGoalWeek = activeFixtures.reduce((latest, match) => match.score && match.score[0] + match.score[1] > 0 && (match.status === 'FT' || !match.status) ? Math.max(latest, match.week) : latest, 0)
  const liveRound = activeFixtures.find((match) => match.score && match.status && /^(?:\d+(?:\+\d+)?[′’']|LIVE|1H|HT|2H|ET|BT|P)$/.test(match.status))?.week
  const upcomingRound = activeFixtures.find((match) => !match.score && (!match.status || match.status === 'NS' || match.status === 'TBD'))?.week
  const currentFplEvent = fpl?.events.find((event) => event.is_current && !event.finished) || fpl?.events.find((event) => event.is_next) || fpl?.events.find((event) => event.is_current)
  const currentMatchweek = liveRound || (activeLeague.id === 'premier' ? currentFplEvent?.id : undefined) || upcomingRound || latestCompletedWeek || (activeLeague.id === 'premier' ? 6 : 1)
  const week = page === 'predictions' ? goalWeek ?? (latestGoalWeek || latestCompletedWeek || currentMatchweek) : sectionWeek
  const nextGoalMatchday = currentMatchweek
  useEffect(() => {
    if (followCurrentWeek.current) setSectionWeek(currentMatchweek)
  }, [activeLeague.id, currentMatchweek, sectionWeek])
  useEffect(() => {
    if (page === 'predictions' && followLatestGoalWeek.current && latestGoalWeek > 0) {
      setGoalWeek(latestGoalWeek)
    }
  }, [page, latestGoalWeek, goalWeek])
  const availableWeeks = [...new Set(activeFixtures.map((match) => match.week))].sort((a, b) => a - b)
  const matchweekOptions = availableWeeks.length ? availableWeeks : [1]
  const clubOptions = ['All clubs', ...new Set(activeFixtures.flatMap((match) => [match.home, match.away])).values()]
  const matches = useMemo(() => activeFixtures.filter((match) => match.week === week && (club === 'All clubs' || match.home === club || match.away === club) && `${match.home} ${match.away}`.toLowerCase().includes(search.toLowerCase())), [activeFixtures, week, club, search])
  useEffect(() => {
    if (activeLeague.id === 'premier' || !activeLeague.apiId) { setApiLeagueState('ready'); setApiLeagueError(''); return }
    const controller = new AbortController()
    setApiLeagueState('loading'); setApiLeagueError(''); setApiFixtures([]); setGoalReports({})
    const query = `league=${activeLeague.apiId}&season=2026`
    const load = async () => {
      try {
        const fixturesResponse = await fetch(`/api/football-data/fixtures?${query}`, { signal: controller.signal })
        const fixturesPayload = await fixturesResponse.json() as ApiFootballPayload<ApiFootballFixture> & { error?: string }
        if (!fixturesResponse.ok) throw new Error(fixturesPayload.error || `League data unavailable (${fixturesResponse.status}).`)
        if (controller.signal.aborted) return
        const nextFixtures = (fixturesPayload.response || []).map(mapApiFixture).filter((match): match is Match => Boolean(match)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        setApiFixtures(nextFixtures)
        setApiLeagueState('ready')
      } catch (error) {
        if (controller.signal.aborted) return
        setApiLeagueState('error')
        setApiLeagueError(error instanceof Error ? error.message : 'League data is unavailable.')
      }
    }
    void load()
    return () => controller.abort()
  }, [activeLeague.id, activeLeague.apiId])
  useEffect(() => {
    if (page !== 'rankings') return
    const controller = new AbortController()
    const leagueId = activeLeague.id
    const premier = leagueId === 'premier'
    const query = `league=${activeLeague.apiId || 39}&season=2026`
    const standingsUrl = premier ? '/api/premier-league/standings?season=2026' : `/api/football-data/standings?${query}`
    async function loadRankings() {
      setRankingFeed((current) => current.leagueId === leagueId ? { ...current, loading: true } : { leagueId, loading: true, standings: [], scorers: [] })
      const read = async <T,>(url: string): Promise<T> => {
        const response = await fetch(url, { signal: controller.signal })
        const payload = await response.json() as T & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'The league feed is temporarily unavailable.')
        return payload
      }
      if (leagueId === 'laliga' || leagueId === 'bundesliga') {
        try {
          const official = await read<{ standings: ApiStanding[]; scorers: ApiTopScorer[]; source: string; updatedAt?: string; standingsError?: string; scorersError?: string }>(`/api/league-rankings?league=${leagueId}&season=2026`)
          if (controller.signal.aborted) return
          setRankingFeed({ leagueId, loading: false, standings: official.standings || [], scorers: official.scorers || [], source: official.source, standingsError: official.standingsError, scorersError: official.scorersError, updatedAt: official.updatedAt ? new Date(official.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined })
          return
        } catch { if (controller.signal.aborted) return }
      }
      const [table, goals] = await Promise.allSettled([
        read<ApiFootballStandingsPayload>(standingsUrl),
        premier ? Promise.resolve({ response: [] } as ApiFootballPayload<ApiTopScorer>) : read<ApiFootballPayload<ApiTopScorer>>(`/api/football-data/topscorers?${query}`),
      ])
      if (controller.signal.aborted) return
      setRankingFeed({ leagueId, loading: false, standings: table.status === 'fulfilled' ? table.value.response?.[0]?.league?.standings?.[0] || [] : [], scorers: goals.status === 'fulfilled' ? goals.value.response || [] : [], source: premier ? 'Official Premier League' : 'API-Football', standingsError: table.status === 'rejected' ? 'The league table could not be loaded for this season.' : undefined, scorersError: goals.status === 'rejected' ? 'Top scorers are unavailable for this league and season.' : undefined, updatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })
    }
    void loadRankings()
    const timer = window.setInterval(() => { void loadRankings() }, 5 * 60_000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [activeLeague.id, activeLeague.apiId, page, refreshKey])
  const fplBadge = (team: Pick<FplTeam, 'name' | 'code'>) => clubBadgeOverrides[team.name] ? `${clubBadgeOverrides[team.name]}?v=crest-alpha-2` : `https://resources.premierleague.com/premierleague/badges/50/t${team.code}@x2.png`
  const calculatedStandings = useMemo(() => fpl && fplFixtures.length ? buildFplStandings(fpl.teams, fplFixtures, fplBadge) : [], [fpl, fplFixtures])
  const fplScorers = useMemo(() => fpl ? buildFplScorers(fpl.elements, fpl.teams, fplBadge) : [], [fpl])
  const currentRankings = rankingFeed.leagueId === activeLeague.id ? rankingFeed : undefined
  const standings = currentRankings?.standings.length ? mapApiStandings(currentRankings.standings).map((row) => {
    const name = activeLeague.id === 'premier' ? ({ Hull: 'Hull City', Ipswich: 'Ipswich Town', Coventry: 'Coventry City' } as Record<string, string>)[row.name] || row.name : row.name
    const calculated = activeLeague.id === 'premier' ? calculatedStandings.find((club) => club.name === name) : undefined
    const badgeId = clubBadgeIds[name]
    const logo = row.logo || calculated?.logo || clubBadgeOverrides[name] || (badgeId ? `https://resources.premierleague.com/premierleague/badges/50/t${badgeId}@x2.png` : undefined)
    return { ...row, name, logo, form: row.form || calculated?.form }
  }) : activeLeague.id === 'premier' ? calculatedStandings : []
  const scorers = activeLeague.id === 'premier' ? fplScorers : mapApiScorers(currentRankings?.scorers || [], activeLeague.apiId || 39)
  const standingsNote = currentRankings?.standings.length ? `${currentRankings.source || 'Official league'} table${activeLeague.id === 'premier' ? ' · Last 5 from FPL results' : ''} · Updated ${currentRankings.updatedAt || 'just now'}.` : activeLeague.id === 'premier' && calculatedStandings.length ? 'Calculated from completed FPL results. Administrative points adjustments are not included.' : currentRankings?.standingsError || (currentRankings?.loading ? 'Loading the official league table…' : 'No standings are available for this league and season yet.')
  const scorersNote = activeLeague.id === 'premier' ? `Season goals and FPL assists from Fantasy Premier League${updatedAt ? ` · Updated ${updatedAt}` : ''}. Players with equal goals share a rank.` : currentRankings?.scorersError || (scorers.length ? `${currentRankings?.source || 'API-Football'} season totals · Updated ${currentRankings?.updatedAt || 'just now'}. Players with equal goals share a rank.` : currentRankings?.loading ? 'Loading season goal totals…' : 'No top scorers are available for this league and season yet.')
  useEffect(() => {
    let active = true
    const played = activeFixtures.filter((match) => match.week === week && match.score && (activeLeague.id === 'premier' ? match.pulseId : match.apiFixtureId))
    setGoalReports({})
    if (activeLeague.id !== 'premier' && played.length) {
      const ids = played.flatMap((match) => match.apiFixtureId ? [match.apiFixtureId] : []).join('-')
      void fetch(`/api/football-data/fixture-details?ids=${ids}`).then(async (response) => {
        if (!response.ok) return null
        const payload = await response.json() as ApiFootballPayload<ApiFootballDetailedFixture>
        return Object.fromEntries(played.flatMap((match, index) => match.apiFixtureId ? [[match.id, mapApiReport({ response: payload.response?.[index] ? [payload.response[index]] : [] }, match.home, match.away)]] : []))
      }).then((reports) => { if (active && reports) setGoalReports(reports) }).catch(() => {})
      return () => { active = false }
    }
    void Promise.all(played.map(async (match) => {
      try {
        const response = await fetch(`/api/premier-league/matches/${match.pulseId}/report`)
        if (!response.ok) return null
        return [match.id, await response.json() as MatchReport] as const
      } catch { return null }
    })).then((reports) => {
      if (active) setGoalReports(Object.fromEntries(reports.filter((item): item is readonly [string, MatchReport] => item !== null)))
    })
    return () => { active = false }
  }, [activeFixtures, activeLeague.id, week])
  const currentEvent = fpl?.events.find((event) => event.id === week)
  const fantasyTargetWeek = fpl?.events.find((event) => event.is_next)?.id ?? currentFplEvent?.id ?? 6
  const difficultyByTeam = new Map<number, number>()
  fplFixtures.filter((fixture) => fixture.event === fantasyTargetWeek).forEach((fixture) => { difficultyByTeam.set(fixture.team_h, fixture.team_h_difficulty); difficultyByTeam.set(fixture.team_a, fixture.team_a_difficulty) })
  const topPicks = (fpl?.elements || []).filter((player) => player.status === 'a' && player.now_cost <= maxPrice * 10 && (player.chance_of_playing_next_round ?? 100) > 0 && (positionFilter === 'All positions' || fpl?.element_types.find((position) => position.id === player.element_type)?.singular_name === positionFilter)).map((player) => ({ player, team: teamById.get(player.team), position: fpl?.element_types.find((position) => position.id === player.element_type)?.singular_name || 'Player', form: Number(player.form) || 0, ep: Number(player.ep_next) || Number(player.points_per_game) || 0, fixture: difficultyByTeam.get(player.team) ?? 3, score: (Number(player.ep_next) || Number(player.points_per_game) || 0) * .55 + (Number(player.expected_goal_involvements) || 0) * 1.1 + (Number(player.form) || 0) * .2 - ((difficultyByTeam.get(player.team) ?? 3) - 3) * .7 + Math.min(player.minutes / 900, 1) })).sort((a, b) => b.score - a.score).slice(0, 12)
  function recordAudit(action: string, detail: string) {
    const entry = { id: Date.now(), timestamp: new Date().toISOString(), action, detail }
    setAuditLog((current) => { const next = [entry, ...current].slice(0, 100); try { localStorage.setItem('plhub-audit-log', JSON.stringify(next)) } catch { /* keep this session's activity even if storage is unavailable */ } return next })
  }
  function selectLeague(league: League) {
    if (league.id === activeLeague.id) { if (page !== 'rankings' && page !== 'coaches') navigate('overview'); return }
    followCurrentWeek.current = true
    followLatestGoalWeek.current = false
    setActiveLeagueId(league.id); setApiFixtures([]); if (page !== 'rankings' && page !== 'coaches') setPage('overview'); setClub('All clubs'); setSearch(''); setSelected(null); setSectionWeek(league.id === 'premier' ? 6 : 1); setGoalWeek(null)
    recordAudit('Changed league', league.name)
  }
  function navigate(nextPage: typeof page, requestedWeek?: number) {
    if (nextPage === 'predictions' && page !== 'predictions') {
      followLatestGoalWeek.current = true
      setGoalWeek(latestGoalWeek || null)
      setClub('All clubs'); setSearch('')
    } else if (nextPage !== 'predictions') {
      followLatestGoalWeek.current = false
      if (nextPage !== page || requestedWeek !== undefined) {
        followCurrentWeek.current = requestedWeek === undefined
        setSectionWeek(requestedWeek ?? currentMatchweek)
      }
      if (page === 'predictions') setClub('All clubs')
    }
    setPage(nextPage)
    if (nextPage === 'rankings' || nextPage === 'coaches' || nextPage === 'predictions') window.scrollTo({ top: 0, behavior: 'instant' })
    if (nextPage !== page) recordAudit('Opened section', nextPage === 'audit' ? 'Activity log' : nextPage === 'design' ? 'Decision' : nextPage === 'cloud' ? 'Cloud simulation' : nextPage === 'fantasy' ? 'Fantasy picks' : nextPage === 'fixtures' ? 'Fixtures & results' : nextPage === 'predictions' ? 'View Goal' : nextPage === 'rankings' ? 'Standings & scorers' : nextPage === 'coaches' ? 'Coaches' : 'Overview')
  }
  function chooseGoalMatchweek(nextWeek: number, followLatest = false) {
    followLatestGoalWeek.current = followLatest
    setGoalWeek(nextWeek)
    recordAudit('Changed goal matchweek', `Matchweek ${nextWeek}`)
  }
  function moveMatchweek(direction: -1 | 1) {
    const currentIndex = matchweekOptions.indexOf(week)
    const nextIndex = Math.min(matchweekOptions.length - 1, Math.max(0, (currentIndex < 0 ? 0 : currentIndex) + direction))
    const nextWeek = matchweekOptions[nextIndex]
    if (nextWeek === undefined || nextWeek === week) return
    if (page === 'predictions') {
      followLatestGoalWeek.current = false
      setGoalWeek(nextWeek)
    } else {
      followCurrentWeek.current = false
      setSectionWeek(nextWeek)
    }
    recordAudit('Changed matchweek', `Matchweek ${nextWeek}`)
  }
  function toggleFavorite(name: string) { setFavorites((current) => { const next = current.includes(name) ? current.filter((clubName) => clubName !== name) : [...current, name]; localStorage.setItem('plhub-favorites', JSON.stringify(next)); recordAudit(next.includes(name) ? 'Followed club' : 'Unfollowed club', name); return next }) }
  useEffect(() => { document.title = `${activeLeague.name} | Match Centre` }, [activeLeague.name])
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [bootstrapResponse, fixturesResponse] = await Promise.all([fetch('/api/fpl/bootstrap'), fetch('/api/fpl/fixtures')])
        if (!bootstrapResponse.ok || !fixturesResponse.ok) throw new Error('FPL unavailable')
        const [bootstrap, fixtures] = await Promise.all([bootstrapResponse.json() as Promise<FplBoot>, fixturesResponse.json() as Promise<FplFixture[]>])
        if (!alive) return
        setFpl(bootstrap); setFplFixtures(fixtures)
        setUpdatedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })); setFplError(false)
      } catch { if (alive) setFplError(true) }
    }
    void load(); const timer = window.setInterval(load, 60_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [refreshKey])
  useEffect(() => {
    const updateClock = () => setJordanClock(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()))
    const timer = window.setInterval(updateClock, 15_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!selected?.score) { setMatchReport(null); setMatchReportState('idle'); return }
    if (activeLeague.id !== 'premier' && selected.apiFixtureId) {
      const cached = goalReports[selected.id]
      if (cached) { setMatchReport(cached); setMatchReportState('ready'); return }
      let active = true
      setMatchReport(null); setMatchReportState('loading')
      fetch(`/api/football-data/fixture-details?ids=${selected.apiFixtureId}`)
        .then(async (response) => { if (!response.ok) throw new Error('Match details unavailable'); return response.json() as Promise<ApiFootballPayload<ApiFootballDetailedFixture>> })
        .then((payload) => { if (active) { const report = mapApiReport(payload, selected.home, selected.away); setMatchReport(report); setGoalReports((current) => ({ ...current, [selected.id]: report })); setMatchReportState('ready') } })
        .catch(() => { if (active) setMatchReportState('error') })
      return () => { active = false }
    }
    if (!selected.pulseId) { setMatchReport(null); setMatchReportState('unavailable'); return }
    let active = true
    setMatchReport(null); setMatchReportState('loading')
    fetch(`/api/premier-league/matches/${selected.pulseId}/report`)
      .then(async (response) => { if (!response.ok) throw new Error('Match report unavailable'); return response.json() as Promise<MatchReport> })
      .then((report) => { if (active) { setMatchReport(report); setMatchReportState('ready') } })
      .catch(() => { if (active) setMatchReportState('error') })
    return () => { active = false }
  }, [activeLeague.id, selected?.id, selected?.pulseId, selected?.apiFixtureId, Boolean(selected?.score)])
  useEffect(() => {
    const controller = new AbortController()
    setLineupCoaches([])
    fetch(`/api/league-coaches?league=${encodeURIComponent(activeLeague.id)}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => response.ok ? await response.json() as { coaches?: CoachRecord[] } : { coaches: [] })
      .then((data) => { if (!controller.signal.aborted) setLineupCoaches(Array.isArray(data.coaches) ? data.coaches : []) })
      .catch(() => { if (!controller.signal.aborted) setLineupCoaches([]) })
    return () => controller.abort()
  }, [activeLeague.id])
  useEffect(() => {
    if (!cloudRunning) return
    const timer = window.setInterval(() => setCloudStats((stats) => ({ cpu: Math.max(8, Math.min(94, Math.round(stats.cpu + (Math.random() * 18 - 8)))), memory: Math.max(30, Math.min(88, Math.round(stats.memory + (Math.random() * 6 - 2)))), latency: Math.max(42, Math.min(210, Math.round(stats.latency + (Math.random() * 32 - 14)))), requests: stats.requests + Math.floor(Math.random() * 8 + 4), uptime: stats.uptime + 1 })), 1000)
    return () => window.clearInterval(timer)
  }, [cloudRunning])
  const weekMatches = activeFixtures.filter((match) => match.week === week)
  const upcomingWeekMatch = weekMatches.find((match) => !match.score)
  const matchHighlights = weekMatches.flatMap((match) => {
    let runningScore: [number, number] = [0, 0]
    const orderedGoals = [...(goalReports[match.id]?.goals || [])].sort((a, b) => {
      const minuteValue = (minute: string) => { const [base, added] = minute.match(/\d+(?:\+\d+)?/)?.[0]?.split('+').map(Number) || [Number.MAX_SAFE_INTEGER]; return base + (added || 0) / 100 }
      return minuteValue(a.minute) - minuteValue(b.minute)
    })
    const goals = orderedGoals.map((goal, goalIndex) => {
      runningScore = [...runningScore] as [number, number]
      runningScore[goal.side === 'home' ? 0 : 1] += 1
      return { match, goal, goalIndex, scoreAtGoal: [...runningScore] as [number, number] }
    })
    return match.score && (match.status === 'FT' || !match.status) ? [{ match, goals }] : []
  })
  const visibleHighlights = matchHighlights.filter(({ match }) => matches.some((listed) => listed.id === match.id))
  const upcomingGoalMatches = matches.filter((match) => !(match.score && (match.status === 'FT' || !match.status)))
  const fantasyFixture = selectedFantasyMatch ? fplFixtures.find((fixture) => selectedFantasyMatch.id === `fpl-${fixture.id}`) : undefined
  const featureMatch = weekMatches[0] || fixtureData[0]
  const leagueFeatureMatch = activeLeague.id === 'premier' ? undefined : weekMatches[0]
  const featureChance = probabilities(featureMatch)
  return <div className="plhub">
    <aside className="pl-sidebar"><a className="pl-brand" href="/football" aria-label="Premier League Hub home"><img src="/premier-league-lion.png" alt="Premier League lion logo in its original colours" /></a><div className="pl-side-caption">MATCH CENTRE</div><nav className="pl-nav" aria-label="Football match centre navigation">{([{ id: 'overview', label: 'Overview', glyph: 'grid' }, { id: 'fixtures', label: 'Fixtures & results', glyph: 'calendar' }, { id: 'predictions', label: 'View Goal', glyph: 'football' }, { id: 'rankings', label: 'Standings & scorers', glyph: 'chart' }, { id: 'coaches', label: 'Coaches', glyph: 'coach' }, { id: 'fantasy', label: 'Fantasy picks', glyph: 'star' }, { id: 'cloud', label: 'Cloud simulation', glyph: 'cloud' }, { id: 'audit', label: 'Activity', glyph: 'clock' }, { id: 'design', label: 'Decision', glyph: 'info' }] as const).map((item) => <button key={item.id} className={page === item.id ? 'selected' : ''} aria-label={item.label} title={item.label} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>{item.glyph === 'football' ? <SoccerBallGlyph /> : item.glyph === 'coach' ? <CoachGlyph /> : <Glyph name={item.glyph} />}{item.label}</button>)}</nav><div className="pl-sidebar-bottom"><div className="pl-season-tag"><span className="pl-season-dot" />Season 2026/27</div><a className="pl-back-link" href="/">‹&nbsp; Back to invoice desk</a></div></aside>
    <main className="pl-main"><header className="pl-topbar"><div className="pl-mobile-brand"><span className="pl-brand-icon"><Glyph name="ball" /></span><strong>PL HUB</strong></div><div className="pl-crumb">{activeLeague.name} <span>/</span> <strong>{page === 'overview' ? 'Match centre' : page === 'fixtures' ? 'Fixtures & results' : page === 'fantasy' ? 'Fantasy picks' : page === 'rankings' ? 'Standings & scorers' : page === 'coaches' ? 'Coaches' : page === 'cloud' ? 'Cloud simulation' : page === 'audit' ? 'Activity log' : page === 'design' ? 'Decision' : 'View Goal'}</strong></div><div className="pl-top-actions"><label className="pl-search"><Glyph name="search" /><input aria-label="Search clubs" value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) navigate('fixtures') }} onKeyDown={(event) => { if (event.key === 'Enter' && search.trim()) recordAudit('Searched clubs', search.trim()) }} placeholder="Search clubs" /></label><span className="pl-jordan-clock" aria-label={`Current time in Amman, Jordan: ${jordanClock}`}><Glyph name="clock"/><span><small>AMMAN</small><time dateTime={jordanClock}>{jordanClock}</time></span></span><span className="pl-season-pill">2026 / 27</span></div></header>
      <div className="pl-content">
        {page !== 'rankings' && page !== 'coaches' && page !== 'predictions' && <section className="pl-hero"><div className="pl-hero-copy"><div className="pl-hero-brand pl-league-selector" role="group" aria-label="Select a league">{leagues.map((league) => <button key={league.id} type="button" className={`pl-league-choice ${league.id === 'premier' ? 'premier' : ''} ${league.id === activeLeague.id ? 'active' : ''}`} aria-label={`Open ${league.name} match centre`} aria-pressed={league.id === activeLeague.id} title={league.name} onClick={() => selectLeague(league)}><LeagueMark league={league} /></button>)}</div><div className="pl-overline"><span className="pl-live-dot" /> THE WORLD'S GAME, AT A GLANCE</div><h1>Every match.<br /><span>Every moment.</span></h1><p>{activeLeague.id === 'premier' ? 'Premier League scores, upcoming fixtures and matchday predictions in one place.' : `${activeLeague.name} fixtures, results and matchday details in one place.`}</p><div className="pl-hero-actions"><button onClick={() => navigate('fixtures')} className="pl-primary-btn">Explore fixtures <Glyph name="arrow" /></button><div className="pl-season-meta"><span>2026 / 27</span><i /> MATCHWEEK {currentMatchweek}</div></div></div><FootballHeroArt /><div className="pl-hero-index">01 <span>/ {activeLeague.matchdays}</span></div></section>}
        {page !== 'rankings' && page !== 'coaches' && <section className="pl-section-head"><div><span className="pl-section-kicker">{activeLeague.name.toUpperCase()} · MATCH CENTRE</span><h2>{page === 'overview' ? 'The weekend, in focus' : page === 'fixtures' ? 'Fixtures & results' : page === 'fantasy' ? 'Fantasy transfer shortlist' : page === 'cloud' ? 'Cloud simulation' : page === 'audit' ? 'Activity log' : page === 'design' ? 'Decision' : 'View Goal'}</h2></div>{page !== 'audit' && page !== 'design' && page !== 'cloud' && <div className="pl-week-picker"><button aria-label="Previous matchweek" disabled={week <= matchweekOptions[0]} onClick={() => moveMatchweek(-1)}>−</button><span>Matchweek {week}</span><button aria-label="Next matchweek" disabled={week >= matchweekOptions[matchweekOptions.length - 1]} onClick={() => moveMatchweek(1)}>+</button></div>}</section>}
        {page === 'overview' && activeLeague.id === 'premier' && <div className="pl-overview-grid"><article className="pl-feature-card"><div className="pl-card-label"><span><i /> NEXT UP</span><span>MW {week} · {clubDate(featureMatch.date).toUpperCase()}</span></div><div className="pl-feature-teams"><div className="pl-feature-team"><ClubMark name={featureMatch.home} size="large" /><strong>{featureMatch.home}</strong></div><span className="pl-vs">VS</span><div className="pl-feature-team"><ClubMark name={featureMatch.away} size="large" /><strong>{featureMatch.away}</strong></div></div><div className="pl-feature-kickoff"><Glyph name="clock" /> {clubLongDate(featureMatch.date)} <span>·</span> {featureMatch.time} Jordan time</div><div className="pl-prob-label"><span>WIN PROBABILITY <b>DEMO MODEL</b></span><span>Illustrative estimates</span></div><div className="pl-prob-meter"><span className="home-meter" style={{ width: `${featureChance.home}%` }} /><span className="draw-meter" style={{ width: `${featureChance.draw}%` }} /><span className="away-meter" style={{ width: `${featureChance.away}%` }} /></div><div className="pl-prob-legend"><span><i className="home-key" /> {featureMatch.home} <b>{featureChance.home}%</b></span><span><i className="draw-key" /> Draw <b>{featureChance.draw}%</b></span><span><i className="away-key" /> {featureMatch.away} <b>{featureChance.away}%</b></span></div><button className="pl-card-open" onClick={() => setSelected(featureMatch)}>View match breakdown <Glyph name="arrow" /></button></article>
          <section className="pl-upcoming panel-pl"><div className="pl-widget-head"><div><span className="pl-section-kicker">ON THE CALENDAR</span><h3>Coming up</h3></div><button onClick={() => navigate('fixtures')}>All fixtures <Glyph name="arrow" /></button></div>{weekMatches.slice(1, 5).map((match) => <button className="pl-upcoming-row" key={match.id} onClick={() => setSelected(match)}><span className="pl-upcoming-date">{clubDate(match.date)}<small>{match.time} Amman</small></span><span className="pl-small-fixture"><ClubMark name={match.home} />{match.home}<b>—</b>{match.away}<ClubMark name={match.away} /></span><Glyph name="chevron" /></button>)}<div className="pl-calendar-note"><Glyph name="calendar" /><span>{upcomingWeekMatch ? `Matchweek ${week} · Next kick-off ${clubDate(upcomingWeekMatch.date)}, ${upcomingWeekMatch.time} Jordan time.` : `Matchweek ${week} · Latest available results.`}</span></div></section>
          <section className="pl-results panel-pl"><div className="pl-widget-head"><div><span className="pl-section-kicker">LATEST SCORES</span><h3>Recent results</h3></div><span className="pl-result-date">{liveMatches.length ? 'LIVE FPL' : 'SAMPLE DATA'}</span></div>{(liveMatches.length ? liveMatches.filter((match) => match.score).slice(-3).reverse() : results).map((match) => <button className="pl-result-row" key={match.id} onClick={() => setSelected(match)}><span className="pl-result-date-mini">{clubDate(match.date)}</span><span className="pl-result-team"><ClubMark name={match.home} />{match.home}</span><strong className="pl-score">{match.score?.[0]} — {match.score?.[1]}</strong><span className="pl-result-team away"><ClubMark name={match.away} />{match.away}</span><span className="pl-result-ft">{match.status || 'FT'}</span></button>)}{!liveMatches.length && <div className="pl-data-note"><span>i</span><p>Sample results shown while the live FPL feed is unavailable.</p></div>}<div className="pl-source-links"><a className="pl-source-link" target="_blank" rel="noreferrer" href="https://fantasy.premierleague.com/">Fantasy Premier League data <Glyph name="external" /></a></div></section>
          <section className="pl-prediction-card"><div className="pl-predict-top"><span className="pl-predict-icon"><Glyph name="ball" /></span><span className="pl-model-pill">MATCHDAY</span></div><h3>Every goal, in match context.</h3><p>Review match scores and the goals that shaped each result.</p><button onClick={() => navigate('predictions')}>Open View Goal <Glyph name="arrow" /></button><div className="pl-predict-decoration" /></section></div>}
        {page !== 'rankings' && page !== 'coaches' && activeLeague.id !== 'premier' && apiLeagueState === 'loading' && <div className="pl-league-data-status" role="status">Loading {activeLeague.name} fixtures…</div>}
        {page !== 'rankings' && page !== 'coaches' && activeLeague.id !== 'premier' && apiLeagueState === 'error' && <div className="pl-league-data-status error" role="alert"><strong>{activeLeague.name} live data is not connected.</strong><span>{apiLeagueError}</span><small>Set API_FOOTBALL_KEY in the project’s .env.local file, then restart the Vite server.</small></div>}
        {page === 'overview' && activeLeague.id !== 'premier' && <div className="pl-overview-grid pl-multileague-overview">
          <article className="pl-feature-card">
            <div className="pl-card-label"><span><i /> MATCHWEEK {week}</span><span>{leagueFeatureMatch ? clubDate(leagueFeatureMatch.date).toUpperCase() : activeLeague.country.toUpperCase()}</span></div>
            {leagueFeatureMatch ? <><div className="pl-feature-teams"><div className="pl-feature-team"><ClubMark name={leagueFeatureMatch.home} size="large" image={leagueFeatureMatch.homeLogo}/><strong>{leagueFeatureMatch.home}</strong></div><span className="pl-vs">{leagueFeatureMatch.score ? `${leagueFeatureMatch.score[0]}–${leagueFeatureMatch.score[1]}` : 'VS'}</span><div className="pl-feature-team"><ClubMark name={leagueFeatureMatch.away} size="large" image={leagueFeatureMatch.awayLogo}/><strong>{leagueFeatureMatch.away}</strong></div></div><div className="pl-feature-kickoff"><Glyph name="clock"/> {clubLongDate(leagueFeatureMatch.date)} <span>·</span> {leagueFeatureMatch.status || `${leagueFeatureMatch.time} Jordan time`}</div><button className="pl-card-open" onClick={() => setSelected(leagueFeatureMatch)}>View match details <Glyph name="arrow"/></button></> : <div className="pl-league-empty">{apiLeagueState === 'loading' ? 'Waiting for the league feed…' : 'No fixtures are available for this matchweek.'}</div>}
          </article>
          <section className="pl-upcoming panel-pl"><div className="pl-widget-head"><div><span className="pl-section-kicker">ON THE CALENDAR</span><h3>Matchweek {week}</h3></div><button onClick={() => navigate('fixtures')}>All fixtures <Glyph name="arrow"/></button></div>{weekMatches.filter((match) => !match.score).slice(0, 5).map((match) => <button className="pl-upcoming-row" key={match.id} onClick={() => setSelected(match)}><span className="pl-upcoming-date">{clubDate(match.date)}<small>{match.time} Jordan time</small></span><span className="pl-small-fixture"><ClubMark name={match.home} image={match.homeLogo}/>{match.home}<b>—</b>{match.away}<ClubMark name={match.away} image={match.awayLogo}/></span><Glyph name="chevron"/></button>)}{!weekMatches.some((match) => !match.score) && <div className="pl-league-empty">No upcoming fixtures in this round.</div>}</section>
          <section className="pl-results panel-pl"><div className="pl-widget-head"><div><span className="pl-section-kicker">LATEST SCORES</span><h3>Recent results</h3></div><span className="pl-result-date">{activeLeague.country.toUpperCase()}</span></div>{apiFixtures.filter((match) => match.score).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((match) => <button className="pl-result-row" key={match.id} onClick={() => setSelected(match)}><span className="pl-result-date-mini">{clubDate(match.date)}</span><span className="pl-result-team"><ClubMark name={match.home} image={match.homeLogo}/>{match.home}</span><strong className="pl-score">{match.score?.[0]} — {match.score?.[1]}</strong><span className="pl-result-team away"><ClubMark name={match.away} image={match.awayLogo}/>{match.away}</span><span className="pl-result-ft">{match.status || 'FT'}</span></button>)}{!apiFixtures.some((match) => match.score) && <div className="pl-league-empty">Played match results will appear here.</div>}</section>
          <section className="pl-prediction-card"><div className="pl-predict-top"><span className="pl-predict-icon"><Glyph name="ball"/></span><span className="pl-model-pill">MATCH REPORTS</span></div><h3>Goals, lineups and match details.</h3><p>Open a played match to view its goal timeline, starting XI and substitutes when the provider has them.</p><button onClick={() => navigate('predictions')}>Open View Goal <Glyph name="arrow"/></button><div className="pl-predict-decoration"/></section>
        </div>}
        {page === 'overview' && <section className="pl-rankings-entry"><div><span className="pl-section-kicker">THE SEASON, AT A GLANCE</span><h3>The race for the top</h3><p>Explore the full league table and the players leading the goal charts.</p></div><div><button onClick={() => { setRankingsTab('standings'); navigate('rankings') }}><Glyph name="chart"/><span>League standings<small>{activeLeague.name}</small></span><Glyph name="chevron"/></button><button onClick={() => { setRankingsTab('scorers'); navigate('rankings') }}><SoccerBallGlyph/><span>Top scorers<small>{activeLeague.id === 'premier' && scorers[0] ? `${scorers[0].name} · ${scorers[0].goals} goals` : 'Season goal leaderboard'}</small></span><Glyph name="chevron"/></button></div></section>}
        {page === 'coaches' && <><div className="pl-rankings-leagues" role="group" aria-label="Choose league coaches">{leagues.map((league) => <button key={league.id} type="button" aria-pressed={league.id === activeLeague.id} onClick={() => selectLeague(league)}><LeagueMark league={league}/><span>{league.id === 'laliga' ? 'LaLiga' : league.id === 'ligue-1' ? 'Ligue 1' : league.name}</span></button>)}</div><LeagueCoaches league={activeLeague}/></>}
        {page === 'rankings' && <><div className="pl-rankings-leagues" role="group" aria-label="Choose league rankings">{leagues.map((league) => <button key={league.id} type="button" aria-pressed={league.id === activeLeague.id} onClick={() => selectLeague(league)}><LeagueMark league={league}/><span>{league.id === 'laliga' ? 'LaLiga' : league.id === 'ligue-1' ? 'Ligue 1' : league.name}</span></button>)}</div><LeagueRankings league={activeLeague} standings={standings} scorers={scorers} loading={Boolean(currentRankings?.loading) || (activeLeague.id === 'premier' && !fpl && !fplError)} standingsNote={standingsNote} scorersNote={scorersNote} initialTab={rankingsTab}/><div className="pl-rankings-source"><a href={activeLeague.officialUrl} target="_blank" rel="noreferrer">Official {activeLeague.name} site <Glyph name="external"/></a><button onClick={() => { recordAudit('Refreshed rankings', activeLeague.name); setRefreshKey((current) => current + 1) }}>Refresh rankings <Glyph name="arrow"/></button></div></>}
        {page === 'cloud' && <section className="pl-fixtures panel-pl pl-cloud"><div className="pl-cloud-toolbar"><div><span className="pl-section-kicker">SYSTEM SANDBOX</span><h3>Cloud run simulator <span className={`pl-cloud-status ${cloudRunning ? 'running' : ''}`}><i />{cloudRunning ? 'SIMULATING' : 'PAUSED'}</span></h3><p>Preview how the match centre services respond under simulated cloud load.</p></div><div className="pl-cloud-actions"><button className="pl-primary-btn" onClick={() => { const next = !cloudRunning; setCloudRunning(next); recordAudit(next ? 'Started cloud simulation' : 'Paused cloud simulation', 'Cloud run simulator'); }}>{cloudRunning ? 'Pause simulation' : 'Start simulation'}</button><button className="pl-clear-audit" onClick={() => { setCloudRunning(false); setCloudStats({ cpu: 18, memory: 42, latency: 84, requests: 0, uptime: 0 }); recordAudit('Reset cloud simulation', 'Restored initial simulated metrics') }}>Reset</button></div></div><div className="pl-cloud-notice"><Glyph name="info"/><p><strong>Simulation only.</strong> These are generated demo metrics in your browser. The app is not deployed to a cloud provider and these are not real server measurements.</p></div><div className="pl-cloud-metrics"><article><span>CPU LOAD</span><b>{cloudStats.cpu}%</b><div className="pl-cloud-meter"><i style={{ width: `${cloudStats.cpu}%` }}/></div><small>Simulated application worker</small></article><article><span>MEMORY</span><b>{cloudStats.memory}%</b><div className="pl-cloud-meter"><i style={{ width: `${cloudStats.memory}%` }}/></div><small>Simulated cache and data layer</small></article><article><span>API LATENCY</span><b>{cloudStats.latency} ms</b><small>Generated request response time</small></article><article><span>REQUESTS</span><b>{cloudStats.requests.toLocaleString()}</b><small>Simulated requests · {Math.floor(cloudStats.uptime / 60)}m {cloudStats.uptime % 60}s runtime</small></article></div><div className="pl-cloud-services"><div className="pl-widget-head"><div><span className="pl-section-kicker">SIMULATED SERVICE MAP</span><h3>Application components</h3></div><span className="pl-result-date">{cloudRunning ? 'RUNNING SCENARIO' : 'READY SCENARIO'}</span></div><div className="pl-service-grid"><article><span className="pl-service-icon"><Glyph name="calendar"/></span><div><b>Fixture service</b><small>Match schedules and live score feed</small></div><em>{liveMatches.length ? 'FEED CONNECTED' : 'SAMPLE MODE'}</em></article><article><span className="pl-service-icon"><Glyph name="star"/></span><div><b>Fantasy recommender</b><small>{fpl ? `${fpl.elements.length} FPL player records loaded` : 'Waiting for public FPL data'}</small></div><em>{fpl ? 'READY' : 'WAITING'}</em></article><article><span className="pl-service-icon"><Glyph name="info"/></span><div><b>Activity storage</b><small>Local browser audit history</small></div><em>LOCAL ONLY</em></article></div></div><div className="pl-data-note"><span>i</span><p>Starting, pausing, and resetting this simulator only changes the on-screen scenario; it does not change live fixtures or fantasy recommendations.</p></div></section>}
        {page === 'audit' && <section className="pl-fixtures panel-pl pl-audit"><div className="pl-fixture-toolbar"><div><span className="pl-section-kicker">LOCAL ACTIVITY HISTORY</span><h3>Recent dashboard actions</h3><p>Navigation, filters, searches and followed clubs from this browser session.</p></div><button className="pl-clear-audit" onClick={() => { localStorage.removeItem('plhub-audit-log'); setAuditLog([]) }}>Clear history</button></div><div className="pl-audit-privacy"><Glyph name="clock"/><span><strong>Stored on this device</strong><small>This activity log is saved in this browser only and is not sent to the FPL API or a server.</small></span><b>{auditLog.length} / 100</b></div>{auditLog.length ? <div className="pl-audit-list">{auditLog.map((entry) => <article className="pl-audit-entry" key={entry.id}><span className="pl-audit-dot"/><time dateTime={entry.timestamp}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(entry.timestamp))}</time><strong>{entry.action}</strong><span>{entry.detail}</span></article>)}</div> : <div className="pl-empty">No activity recorded yet. Using a tab, changing a filter, or following a club will appear here.</div>}</section>}
        {page === 'design' && <section className="pl-fixtures panel-pl pl-audit"><div className="pl-design-rationale"><span className="pl-section-kicker">DECISION</span><h3>Why the dashboard looks this way</h3><div className="pl-rationale-grid"><article><b>Fast matchday scanning</b><p>Fixtures, scores and matchweek controls are grouped so the key details are easy to compare at a glance.</p></article><article><b>Keep the league identity</b><p>Your lion image stays in its original colors. The dark plum and bright lime interface keeps strong contrast and a clear sports feel.</p></article><article><b>Make recommendations explainable</b><p>Fantasy picks show price, form, expected points and fixture difficulty so you can see what influences the shortlist.</p></article><article><b>Separate data confidence</b><p>Live FPL data is identified separately from illustrative match probabilities; recommendations are suggestions, not transfers.</p></article></div><p className="pl-rationale-note">This is a concise summary of the design decisions, not a transcript of private model reasoning.</p></div></section>}
        {page === 'fantasy' && <section className="pl-fixtures panel-pl pl-fantasy"><div className="pl-fixture-toolbar"><div><span className="pl-section-kicker">LIVE FPL DATA · {updatedAt ? `UPDATED ${updatedAt}` : 'CONNECTING'}</span><h3>Buy shortlist for the next gameweek</h3><p>Ranked from FPL form, expected points, availability, minutes and fixture difficulty.</p></div><button className="pl-primary-btn" onClick={() => { recordAudit('Refreshed FPL data', 'Requested an updated player and fixture feed'); setRefreshKey((key) => key + 1) }}>Refresh data</button></div><div className="pl-fantasy-controls"><label>Position<select value={positionFilter} onChange={(event) => { setPositionFilter(event.target.value); recordAudit('Changed fantasy position filter', event.target.value) }}><option>All positions</option>{fpl?.element_types.map((position) => <option key={position.id}>{position.singular_name}</option>)}</select></label><label>Max price <b>£{maxPrice.toFixed(1)}m</b><input type="range" min="4" max="15" step="0.5" value={maxPrice} onChange={(event) => { setMaxPrice(Number(event.target.value)); recordAudit('Changed fantasy price limit', `Up to £${Number(event.target.value).toFixed(1)}m`) }} /></label></div>{fplError && <div className="pl-data-note"><span>!</span><p>Live Fantasy Premier League data could not be reached. Sample match data is not a live feed.</p></div>}{topPicks.length ? <div className="pl-player-grid">{topPicks.map(({ player, team, position, ep, form, fixture }, index) => <article className="pl-player-card" key={player.id}><div className="pl-player-rank">PICK {String(index + 1).padStart(2, '0')}</div><div className="pl-player-heading"><ClubMark name={team?.name || ''} size="large"/><div><h4>{player.web_name}</h4><span>{position} · {team?.name}</span></div></div><div className="pl-player-stats"><span><b>{ep.toFixed(1)}</b><small>EP next GW</small></span><span><b>{form.toFixed(1)}</b><small>Form</small></span><span><b>£{(player.now_cost / 10).toFixed(1)}m</b><small>Price</small></span></div><div className="pl-player-fixture">Next fixture difficulty <strong>{fixture}/5</strong></div></article>)}</div> : <div className="pl-empty">{fpl ? 'No available players match these filters.' : 'Loading live FPL players…'}</div>}<div className="pl-data-note"><span>i</span><p>Suggestions are general guidance from public FPL data, not personalized to your squad or budget. Prices and availability can change. Review your squad and deadline before transfers; this dashboard does not submit transfers.</p></div></section>}
        {page === 'predictions' && <section className="pl-fixtures panel-pl pl-match-highlights">
          <div className="pl-fixture-toolbar">
            <div><span className="pl-section-kicker">MATCHWEEK {week} · GOALS AND REPLAYS</span><h3>View Goal</h3><p>Tap a match to watch its goals on beIN SPORTS or an official highlights clip. Open Fantasy stats beside it.</p></div>
            <div className="pl-filters pl-highlight-filters">
              <label><span>Club</span><select value={club} onChange={(event) => { setClub(event.target.value); recordAudit('Filtered match goals by club', event.target.value) }}>{clubOptions.map((team) => <option key={team}>{team}</option>)}</select></label>
            </div>
          </div>
          <div className="pl-goal-week-summary"><p>{latestGoalWeek > 0 ? <>Latest round with goals: <strong>Matchweek {latestGoalWeek}</strong></> : 'Waiting for scored goals'}{activeLeague.id === 'premier' && updatedAt && <small>Updated {updatedAt}</small>}</p><div>{latestGoalWeek > 0 && <button className={week === latestGoalWeek ? 'active' : ''} onClick={() => chooseGoalMatchweek(latestGoalWeek, true)}>Latest goals · MW {latestGoalWeek}</button>}{Number.isFinite(nextGoalMatchday) && nextGoalMatchday !== week && <button onClick={() => chooseGoalMatchweek(nextGoalMatchday)}>Matchday {nextGoalMatchday}<Glyph name="arrow"/></button>}</div></div>
          <div className="pl-match-highlight-grid">
            {visibleHighlights.map(({ match, goals }) => <MatchHighlightCard key={match.id} match={match} goals={goals} onPlay={(clip, match) => setSelectedClip({ clip, match })} onFantasy={setSelectedFantasyMatch} fantasyAvailable={activeLeague.id === 'premier' && fplFixtures.some((fixture) => match.id === `fpl-${fixture.id}`)}/>)}
            {visibleHighlights.length === 0 && upcomingGoalMatches.length === 0 && <div className="pl-empty">{matches.length === 0 && (club !== 'All clubs' || search) ? 'No matches match your club or search filter.' : activeLeague.id === 'premier' && !fpl && !fplError ? 'Loading the latest played matches…' : 'No completed match results are available for this matchweek yet.'}</div>}
          </div>
          {upcomingGoalMatches.length > 0 && <section className="pl-goals-upcoming" aria-label={`Matches for Matchweek ${week}`}><div className="pl-goals-upcoming-heading"><div><span className="pl-section-kicker">{activeLeague.id === 'premier' && !liveMatches.length ? 'SAMPLE FIXTURES' : 'MATCHDAY SCHEDULE'}</span><h4>Matchweek {week} · {visibleHighlights.length ? 'Remaining matches' : 'Upcoming matches'}</h4><p>Goals and clips will appear as these matches are completed.</p></div></div><div>{upcomingGoalMatches.map((match, index) => <MatchRow key={match.id} match={match} index={index} onSelect={() => setSelected(match)} favorite={favorites.includes(match.home)} onFavorite={toggleFavorite} prediction={false} coaches={lineupCoaches}/>)}</div></section>}
          <div className="pl-data-note"><span>i</span><p>beIN SPORTS clips are shown first, with official highlights where available. Each clip is matched to the clubs, result and fixture date. Unavailable clips are clearly marked.</p></div>
        </section>}
        {page === 'fixtures' && <section className="pl-fixtures panel-pl"><div className="pl-fixture-toolbar"><div><span className="pl-section-kicker">{activeLeague.id === 'premier' ? (liveMatches.length ? 'LIVE FPL FIXTURE LIST' : 'SAMPLE FIXTURE LIST') : 'LIVE LEAGUE FIXTURES'}</span><h3>Matchweek {week}</h3><p>{activeLeague.id === 'premier' ? currentEvent?.name || `Matchweek ${week}` : `${activeLeague.name} · Matchweek ${week}`} · Kick-off times shown in Jordan time</p></div><div className="pl-filters"><label><span className="sr-only">Filter by club</span><select value={club} onChange={(event) => { setClub(event.target.value); recordAudit('Filtered fixtures by club', event.target.value) }}>{clubOptions.map((team) => <option key={team}>{team}</option>)}</select></label></div></div><div className="pl-table-head"><span>MATCH</span><span>HOME · KICK-OFF · AWAY</span><span>{activeLeague.id === 'premier' ? 'WIN / DRAW / WIN · DEMO' : 'MATCH DETAILS'}</span><span /></div><div className="pl-match-list">{matches.map((match, index) => <Fragment key={match.id}>{index > 0 && matches[index - 1].date !== match.date && <div className="pl-date-divider"><span><i />{clubDate(match.date)} <small>MATCHDAY</small></span></div>}<MatchRow match={match} index={index} onSelect={() => setSelected(match)} favorite={favorites.includes(match.home)} onFavorite={(name) => toggleFavorite(name)} prediction={false} coaches={lineupCoaches} /></Fragment>)}{matches.length === 0 && <div className="pl-empty">No fixtures match that filter. Try another club or search.</div>}</div><div className="pl-data-note"><span>i</span><p>{activeLeague.id !== 'premier' ? 'Fixtures are provided by API-Football; completed match reports include goals and lineups when available.' : liveMatches.length ? 'Fixtures and scores are from the public Fantasy Premier League feed.' : 'The live FPL fixture feed is unavailable; any sample fixtures shown are clearly labeled.'}</p></div></section>}
        {page === 'overview' && activeLeague.id === 'premier' && <div className="pl-footer-note"><span>{liveMatches.length ? `Live FPL fixture and player feed${updatedAt ? ` · refreshed ${updatedAt}` : ''}.` : 'Showing sample fixtures while the live FPL feed is unavailable.'}</span><button onClick={() => navigate('fantasy')}>See fantasy player picks <Glyph name="arrow" /></button></div>}
        <footer className="pl-footer"><span>{activeLeague.name.toUpperCase()} <i /> MATCH CENTRE</span><span>Demo dashboard · <a href={activeLeague.id === 'premier' ? `https://www.premierleague.com/en/matches/premier-league/2026-27/matchweek-${currentMatchweek}` : activeLeague.officialUrl} target="_blank" rel="noreferrer">Official match centre <Glyph name="external" /></a></span></footer>
      </div>
    </main>
    {selectedClip && <MatchClipPlayer clip={selectedClip.clip} match={selectedClip.match} onClose={() => setSelectedClip(null)} onFantasy={activeLeague.id === 'premier' && fplFixtures.some((fixture) => selectedClip.match.id === `fpl-${fixture.id}`) ? () => { setSelectedFantasyMatch(selectedClip.match); setSelectedClip(null) } : undefined}/>}
    {selectedFantasyMatch && fantasyFixture && <FantasyMatchPanel match={selectedFantasyMatch} fixture={fantasyFixture} players={fpl?.elements || []} onClose={() => setSelectedFantasyMatch(null)}/>}
    {selected && <div className="pl-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="pl-match-modal" role="dialog" aria-modal="true" aria-labelledby="pl-match-title"><button className="pl-modal-close" aria-label="Close match details" onClick={() => setSelected(null)}>×</button><span className="pl-section-kicker">MATCH DETAIL · MATCHWEEK {selected.week}</span><h2 id="pl-match-title">{selected.home} <span>v</span> {selected.away}</h2><p className="pl-modal-date">{clubLongDate(selected.date)} · {selected.score ? 'Full time' : `${selected.time} Jordan time kick-off`}</p>{selected.venue && <div className="pl-modal-venue" style={{ '--stadium-photo': stadiumPhoto?.venue === selected.venue ? `url("${stadiumPhoto.photo.image}")` : 'none' } as CSSProperties}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></svg><span><small>STADIUM</small><strong>{selected.venue}</strong>{stadiumPhoto?.venue === selected.venue && <a href={stadiumPhoto.photo.page} target="_blank" rel="noopener noreferrer">Photo: {stadiumPhoto.photo.credit || 'Wikimedia Commons'}{stadiumPhoto.photo.license ? ` · ${stadiumPhoto.photo.license}` : ''}</a>}</span></div>}{selected.score ? <MatchScorecard home={selected.home} away={selected.away} score={selected.score} report={matchReport} state={matchReportState} homeLogo={selected.homeLogo} awayLogo={selected.awayLogo} /> : activeLeague.id === 'premier' ? <><div className="pl-modal-probs">{Object.entries(probabilities(selected)).map(([key, value]) => <div key={key}><span>{key === 'home' ? selected.home : key === 'away' ? selected.away : 'Draw'}</span><strong>{value}%</strong><div className="pl-prob-meter"><i style={{ width: `${value}%` }} /></div></div>)}</div><div className="pl-modal-disclaimer">Illustrative demo estimates only. Based on sample team ratings and a home advantage factor; no live form or injury data is connected.</div></> : <div className="pl-modal-disclaimer">Match outcome predictions are not available for this league yet.</div>}{selected.score && <MatchReportPanel home={selected.home} away={selected.away} report={matchReport} state={matchReportState} fplPlayers={fpl?.elements || []} homeCoach={coachNameFor(selected.home, lineupCoaches)} awayCoach={coachNameFor(selected.away, lineupCoaches)} />}<button className="pl-primary-btn pl-modal-action" onClick={() => { toggleFavorite(selected.home); setSelected(null) }}><Glyph name="star" /> {favorites.includes(selected.home) ? 'Remove home team from favourites' : `Follow ${selected.home}`}</button></section></div>}
  </div>
}

function MatchRow({ match, index, onSelect, favorite, onFavorite, prediction, coaches = [] }: { match: Match; index: number; onSelect: () => void; favorite: boolean; onFavorite: (name: string) => void; prediction: boolean; coaches?: CoachRecord[] }) {
  const chance = probabilities(match)
  const teamCopy = (team: string) => { const coach = coachNameFor(team, coaches); return <span className="pl-match-team-copy"><strong>{team}</strong>{coach && <small>Coach · {coach}</small>}</span> }
  return <article className="pl-match-row" style={{ animationDelay: `${index * 45}ms` }}><button className="pl-match-main" onClick={onSelect}><span className="pl-match-date">{clubDate(match.date)}</span><span className="pl-match-teams"><span className="pl-home-team">{teamCopy(match.home)}<ClubMark name={match.home} image={match.homeLogo} /></span><b className="pl-match-center">{match.score ? `${match.score[0]}–${match.score[1]}` : match.status || match.time}</b><span className="pl-away-team"><ClubMark name={match.away} image={match.awayLogo} />{teamCopy(match.away)}</span></span>{prediction ? <span className="pl-prob-chips"><i>{chance.home}%</i><i>{chance.draw}%</i><i>{chance.away}%</i></span> : null}</button><div className="pl-row-actions"><button aria-label={`${favorite ? 'Unfollow' : 'Follow'} ${match.home}`} title={`Follow ${match.home}`} className={favorite ? 'favorited' : ''} onClick={() => onFavorite(match.home)}><Glyph name="star" /></button><button aria-label={`View ${match.home} versus ${match.away}`} onClick={onSelect}><Glyph name="chevron" /></button></div></article>
}
function FootballIcon({ kind }: { kind: 'ball' | 'boot' }) {
  return kind === 'ball'
    ? <span className="pl-football-icon pl-ball-glyph" aria-hidden="true">⚽</span>
    : <svg className="pl-football-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 14.2 3.2-1.1 2.4-5.8 2.5.7.8 3.4c.3 1.2 1 2 2.2 2.3l4.2 1.1c1.1.3 1.9 1.3 1.9 2.4v1.9H4v-4.9Z"/><path d="m7.8 13.2 2.4 1.4m.8-3.3 2.6 1.8m-1.7-5.4-1.1 3.1m5.4 1.4 1.8 1.7"/></svg>
}

function MatchScorecard({ home, away, score, report, state, homeLogo, awayLogo }: { home: string; away: string; score: [number, number]; report: MatchReport | null; state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'; homeLogo?: string; awayLogo?: string }) {
  const colorStyle = (team: string) => {
    const alias = /coventry/i.test(team) ? crestColors.Coventry : /ipswich/i.test(team) ? crestColors.Ipswich : /leeds/i.test(team) ? crestColors.Leeds : /bournemouth/i.test(team) ? crestColors['AFC Bournemouth'] : undefined
    return { '--club-color': scorecardColors[team] || scorecardColors[/coventry/i.test(team) ? 'Coventry' : /ipswich/i.test(team) ? 'Ipswich' : /leeds/i.test(team) ? 'Leeds' : /bournemouth/i.test(team) ? 'Bournemouth' : ''] || crestColors[team] || alias || '#5a367c', '--club-ink': /leeds|hull|brighton|ipswich/i.test(team) ? '#21172d' : '#fff' } as CSSProperties
  }
  const goals = report?.eventsAvailable ? [...report.goals].sort((a, b) => {
    const minute = (value: string) => { const parts = value.match(/(\d+)(?:\+(\d+))?/); return parts ? Number(parts[1]) * 100 + Number(parts[2] || 0) : Number.MAX_SAFE_INTEGER }
    return minute(a.minute) - minute(b.minute)
  }) : []
  return <section className="pl-match-scorecard" aria-label={`${home} ${score[0]}, ${away} ${score[1]}, full time`}>
    <div className="pl-scorecard-teams">
      <div className={`pl-scorecard-team home ${/ipswich/i.test(home) ? 'ipswich' : ''} ${/coventry/i.test(home) ? 'coventry' : ''} ${/nott|nottingham/i.test(home) ? 'nottingham' : ''}`} style={colorStyle(home)}><ClubMark name={home} size="large" image={homeLogo}/><strong>{home}</strong><small>HOME</small></div>
      <div className={`pl-scorecard-team away ${/ipswich/i.test(away) ? 'ipswich' : ''} ${/coventry/i.test(away) ? 'coventry' : ''} ${/nott|nottingham/i.test(away) ? 'nottingham' : ''}`} style={colorStyle(away)}><ClubMark name={away} size="large" image={awayLogo}/><strong>{away}</strong><small>AWAY</small></div>
      <div className="pl-scorecard-score"><strong>{score[0]} <i>–</i> {score[1]}</strong><small>FULL TIME</small></div>
    </div>
    <div className="pl-scorecard-goals" aria-live="polite">
      {state === 'loading' && <p>Loading goal details…</p>}
      {state === 'ready' && report?.eventsAvailable && <div className="pl-scorecard-goal-columns">{([{ side: 'home' as const, team: home }, { side: 'away' as const, team: away }]).map(({ side, team }) => {
        const teamGoals = goals.filter((goal) => goal.side === side)
        return <section className={`pl-scorecard-goal-team ${side}`} key={side} aria-label={`${team} goals`}>
          <header><ClubMark name={team}/><strong>{team}</strong><span>{teamGoals.length} {teamGoals.length === 1 ? 'GOAL' : 'GOALS'}</span></header>
          {teamGoals.length ? <ol>{teamGoals.map((goal, index) => <li key={`${goal.minute}-${goal.scorer}-${index}`}><FootballIcon kind="ball"/><time>{goal.minute}</time><span><strong>{goal.scorer}</strong>{goal.assist && <small>Assist: {goal.assist}</small>}</span></li>)}</ol> : <p>No goals</p>}
        </section>
      })}</div>}
      {state === 'ready' && report && !report.eventsAvailable && <p>Goal details are not available from the match-centre feed.</p>}
      {(state === 'error' || state === 'unavailable') && <p>Goal details are temporarily unavailable.</p>}
    </div>
  </section>
}

function MatchReportPanel({ home, away, report, state, fplPlayers, homeCoach, awayCoach }: { home: string; away: string; report: MatchReport | null; state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'; fplPlayers: FplPlayer[]; homeCoach?: string; awayCoach?: string }) {
  return <section className="pl-match-report" aria-live="polite">
    <div className="pl-match-report-heading"><span className="pl-section-kicker">MATCH REPORT</span><span>STARTING LINEUPS</span></div>
    {state === 'loading' && <p className="pl-match-report-note">Loading starting lineups…</p>}
    {state === 'error' && <p className="pl-match-report-note">Match details are temporarily unavailable. Please try again later.</p>}
    {state === 'unavailable' && <p className="pl-match-report-note">This match has no linked match-centre detail yet.</p>}
    {state === 'ready' && report && (report.lineupsAvailable ? <LineupPitch home={home} away={away} homePlayers={report.homeStarters} awayPlayers={report.awayStarters} homeBench={report.homeBench || []} awayBench={report.awayBench || []} benchAvailable={Boolean(report.benchAvailable)} goals={report.goals} fplPlayers={fplPlayers} homeCoach={homeCoach} awayCoach={awayCoach}/> : <p className="pl-match-report-note">Starting lineups are not available from the match-centre feed.</p>)}
  </section>
}

function PlayerPortrait({ name, photo }: { name: string; photo?: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className={`pl-player-portrait ${photo && !failed ? 'has-photo' : ''}`} aria-hidden="true">{photo && !failed ? <img src={photo} alt="" loading="lazy" onError={() => setFailed(true)} /> : <b>{initials}</b>}</span>
}

function LineupPitch({ home, away, homePlayers, awayPlayers, homeBench, awayBench, benchAvailable, goals, fplPlayers, homeCoach, awayCoach }: { home: string; away: string; homePlayers: MatchReportPlayer[]; awayPlayers: MatchReportPlayer[]; homeBench: MatchReportPlayer[]; awayBench: MatchReportPlayer[]; benchAvailable: boolean; goals: MatchReport['goals']; fplPlayers: FplPlayer[]; homeCoach?: string; awayCoach?: string }) {
  const normalized = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const fantasyPlayerFor = (name: string) => {
    const identity = normalized(name)
    return fplPlayers.find((candidate) => {
      const fullName = normalized(`${candidate.first_name || ''} ${candidate.second_name || ''}`)
      return fullName === identity || normalized(candidate.web_name) === identity
    })
  }
  const photoFor = (name: string) => {
    const reportedPhoto = [...homePlayers, ...awayPlayers, ...homeBench, ...awayBench].find((player) => player.name === name)?.photo
    if (reportedPhoto) return reportedPhoto
    const player = fantasyPlayerFor(name)
    const photoId = player?.photo?.match(/\d+/)?.[0]
    return photoId ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoId}.png` : undefined
  }
  const positionFor = (player: MatchReportPlayer) => {
    const reportedPosition = player.position?.trim()
    const genericRoles = new Set(['substitute', 'sub', 'bench', 'player'])
    const actualPosition = reportedPosition && !genericRoles.has(reportedPosition.toLowerCase()) ? reportedPosition : undefined
    return actualPosition || ({ 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward' } as Record<number, string>)[fantasyPlayerFor(player.name)?.element_type || 0] || 'Position unavailable'
  }
  const positionBand = (position = '') => {
    const value = position.toLowerCase()
    if (value.includes('goal')) return 'keeper'
    if (value.includes('def')) return 'defence'
    if (value.includes('forward') || value.includes('striker')) return 'forward'
    return 'midfield'
  }
  const positions: Record<string, number> = { keeper: 8, defence: 20, midfield: 32, forward: 44 }
  const awayPositions: Record<string, number> = { keeper: 92, defence: 80, midfield: 68, forward: 56 }
  const renderTeam = (players: MatchReportPlayer[], side: 'home' | 'away') => {
    const groups = new Map<string, MatchReportPlayer[]>()
    for (const player of players) {
      const band = positionBand(player.position)
      groups.set(band, [...(groups.get(band) || []), player])
    }
    return [...groups.entries()].flatMap(([band, members]) => members.map((player, index) => {
      const y = (side === 'home' ? positions : awayPositions)[band]
      const x = ((index + 1) / (members.length + 1)) * 100
      const playerGoals = goals.filter((goal) => goal.side === side && normalized(goal.scorer) === normalized(player.name))
      const playerAssists = goals.filter((goal) => goal.side === side && goal.assist && normalized(goal.assist) === normalized(player.name))
      return <div className={`pl-pitch-player ${side}`} key={`${side}-${player.shirtNumber}-${player.name}`} style={{ left: `${x}%`, top: `${y}%` }} title={`${player.name}${player.position ? ` · ${player.position}` : ''}`} aria-label={`${player.name}, ${player.position || 'player'}, ${side === 'home' ? home : away}`}><span className="pl-pitch-shirt-number">{player.shirtNumber || '—'}</span><span className="pl-pitch-player-visual"><PlayerPortrait name={player.name} photo={photoFor(player.name)}/>{(playerGoals.length > 0 || playerAssists.length > 0) && <span className="pl-player-events">{playerGoals.map((goal, eventIndex) => <i className="goal" key={`goal-${eventIndex}`} title={`Goal ${goal.minute}`} aria-label={`Goal ${goal.minute}`}><FootballIcon kind="ball"/>{goal.minute}</i>)}{playerAssists.map((goal, eventIndex) => <i className="assist" key={`assist-${eventIndex}`} title={`Assist for ${goal.scorer}, ${goal.minute}`} aria-label={`Assist for ${goal.scorer}, ${goal.minute}`}><FootballIcon kind="boot"/>{goal.minute}</i>)}</span>}</span><strong>{player.name}</strong></div>
    }))
  }
  const renderBench = (players: MatchReportPlayer[], team: string, side: 'home' | 'away') => <section className={`pl-lineup-bench-team ${side}`} aria-label={`${team} substitutes`}><header><div><strong>{team}</strong><span>SUBSTITUTES</span></div><small>{players.length} {players.length === 1 ? 'PLAYER' : 'PLAYERS'}</small></header>{players.length ? <ul>{players.map((player) => <li key={`${side}-${player.shirtNumber}-${player.name}`}><span className="pl-bench-number">{player.shirtNumber || '—'}</span><PlayerPortrait name={player.name} photo={photoFor(player.name)}/><span className="pl-bench-player-copy"><strong>{player.name}</strong><small>{positionFor(player)}</small></span></li>)}</ul> : <p>No substitutes listed</p>}</section>
  return <div className="pl-lineup-pitch-wrap">
    <div className="pl-pitch-team-label home"><span className="pl-pitch-team-title"><span>{home}</span>{homeCoach && <strong>Coach · {homeCoach}</strong>}</span><small>HOME</small></div>
    <div className="pl-lineup-legend" aria-label="Lineup event key"><span><FootballIcon kind="ball"/>Goal</span><span><FootballIcon kind="boot"/>Assist</span></div>
    <div className="pl-lineup-pitch" role="group" aria-label={`Starting lineups on a pitch: ${home} against ${away}`}>
      <i className="pl-pitch-halfway" aria-hidden="true" /><i className="pl-pitch-circle" aria-hidden="true" /><i className="pl-pitch-center-spot" aria-hidden="true" />
      <i className="pl-pitch-box top" aria-hidden="true" /><i className="pl-pitch-box bottom" aria-hidden="true" />
      {renderTeam(homePlayers, 'home')}{renderTeam(awayPlayers, 'away')}
    </div>
    <div className="pl-pitch-team-label away"><small>AWAY</small><span className="pl-pitch-team-title"><span>{away}</span>{awayCoach && <strong>Coach · {awayCoach}</strong>}</span></div>
    <div className="pl-lineup-bench"><div className="pl-lineup-bench-heading"><strong>Matchday bench</strong><span>{benchAvailable ? 'SUBSTITUTES' : 'SQUAD DETAILS'}</span></div>{benchAvailable ? <div className="pl-lineup-bench-grid">{renderBench(homeBench, home, 'home')}{renderBench(awayBench, away, 'away')}</div> : <p className="pl-lineup-bench-empty">Substitute details are not available in the match-centre lineup feed.</p>}</div>
  </div>
}
