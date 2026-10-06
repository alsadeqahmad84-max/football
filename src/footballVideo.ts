export type VideoFixture = { home: string; away: string; date: string; score?: [number, number] }

export type MatchClip = { title: string; date: string; source: 'beIN SPORTS' | 'Sky Sports'; url: string; sourceUrl?: string; embedUrl?: string; thumbnail?: string; duration?: number }
export type MatchClipResult = { clip: MatchClip | null; status: 'ready' | 'unavailable'; message?: string }
const teamAliases: Record<string, string> = {
  'man city': 'manchester city', 'man utd': 'manchester united', 'manchester utd': 'manchester united',
  spurs: 'tottenham', 'tottenham hotspur': 'tottenham', 'nott m forest': 'nottingham forest', 'nott forest': 'nottingham forest',
  'brighton and hove albion': 'brighton', 'brighton hove albion': 'brighton', 'afc bournemouth': 'bournemouth',
  'ipswich town': 'ipswich', 'coventry city': 'coventry', 'leeds united': 'leeds', 'newcastle united': 'newcastle', 'newcastle utd': 'newcastle',
  'paris saint germain': 'psg', 'atletico madrid': 'atletico', 'atletico de madrid': 'atletico', 'fc barcelona': 'barcelona',
  'internazionale': 'inter', 'inter milan': 'inter', 'fc bayern munchen': 'bayern munich', 'bayern munchen': 'bayern munich',
}
function normalizeTeam(value: string) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return teamAliases[normalized] || normalized.replace(/^(?:fc|ac|ssc)\s+|\s+(?:fc|cf)$/g, '')
}
// Match the clubs, home/away order, score and upload date, rather than related
// fixture names that may appear elsewhere on a provider's news page.
export function clipMatchesFixture(clip: Pick<MatchClip, 'title' | 'date'>, fixture: VideoFixture): boolean {
  if (!fixture.score || !/highlights|all.*goals|match goals/i.test(clip.title)) return false
  const score = /^(.*?)\s+(\d{1,2})\s*[-–:]\s*(\d{1,2})\s+(.+)$/.exec(clip.title.split('|')[0].trim())
  if (!score || Number(score[2]) !== fixture.score[0] || Number(score[3]) !== fixture.score[1]) return false
  if (normalizeTeam(score[1]) !== normalizeTeam(fixture.home) || normalizeTeam(score[4]) !== normalizeTeam(fixture.away)) return false
  const delay = Date.parse(clip.date) - Date.parse(`${fixture.date}T00:00:00Z`)
  return Number.isFinite(delay) && delay >= -6 * 60 * 60_000 && delay < 3 * 24 * 60 * 60_000
}
export function matchClipLookupUrl(fixture: VideoFixture): string {
  return `/api/football-highlights/match?${new URLSearchParams({ home: fixture.home, away: fixture.away, date: fixture.date, score: fixture.score?.join('-') || '' })}`
}
