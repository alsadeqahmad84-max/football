import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { clipMatchesFixture, type MatchClip, type MatchClipResult, type VideoFixture } from '../src/footballVideo.ts'

type SearchHit = { url?: string; title?: string }
type JsonObject = Record<string, unknown>
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
const text = (value: unknown) => typeof value === 'string' ? value : ''

async function publicHtml(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { Accept: 'text/html' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Video provider unavailable')
  const body = await response.text()
  if (body.length > 8_000_000) throw new Error('Video catalogue too large')
  return body
}

function beINClips(html: string): MatchClip[] {
  const data = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!data) throw new Error('Video catalogue format changed')
  const root: unknown = JSON.parse(data)
  const articleUrls = new Map<string, string>()
  for (const match of html.matchAll(/href="([^"]*\/articles-video\/[^"?#]+)[^\"]*"/g)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, '&'), 'https://www.beinsports.com')
      if (url.hostname === 'www.beinsports.com' && url.protocol === 'https:') articleUrls.set(url.pathname.split('/').pop()!, url.href)
    } catch { /* Ignore unrelated links. */ }
  }
  const clips = new Map<string, MatchClip>()
  function visit(value: unknown, depth = 0) {
    if (depth > 30 || !value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return }
    const article = object(value)
    const raw = object(article.video_manager).video_manager__video_manager
    if (typeof raw === 'string') {
      try {
        const videos: unknown = JSON.parse(raw)
        for (const value of Array.isArray(videos) ? videos : []) {
          const video = object(value)
          const url = new URL(text(video.url))
          const videoId = /^\/video\/([a-zA-Z0-9]+)$/.exec(url.pathname)?.[1]
          const title = text(video.name)
          if (!['dailymotion.com', 'www.dailymotion.com'].includes(url.hostname) || url.protocol !== 'https:' || !videoId || !/highlights|all.*goals|match goals/i.test(title)) continue
          let slug = ''
          try { slug = text(JSON.parse(text(article.url_slug))[0]) } catch { /* Source link is optional. */ }
          const embed = new URL('https://geo.dailymotion.com/player/xakml.html')
          embed.searchParams.set('video', videoId)
          // Use the player configuration published by beIN, including its ads.
          embed.searchParams.set('customConfig[keyvalues]', '&VPOS=preroll&sport=football')
          embed.searchParams.set('customConfig[premium]', 'false')
          const clip: MatchClip = { title, date: text(video.createdAt) || text(article.publication_date), source: 'beIN SPORTS', url: url.href, embedUrl: embed.href, sourceUrl: articleUrls.get(slug), thumbnail: `https://www.dailymotion.com/thumbnail/video/${videoId}`, duration: typeof video.duration === 'number' ? video.duration : undefined }
          const previous = clips.get(videoId)
          if (!previous || (!previous.sourceUrl && clip.sourceUrl)) clips.set(videoId, clip)
        }
      } catch { /* A malformed record must not discard the whole catalogue. */ }
    }
    for (const item of Object.values(article)) visit(item, depth + 1)
  }
  visit(root)
  return [...clips.values()]
}

function skyClip(html: string, url: string, fixture: VideoFixture): MatchClip | null {
  const items: JsonObject[] = []
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const item = JSON.parse(match[1])
      items.push(...(Array.isArray(item) ? item.map(object) : [object(item)]))
    } catch { /* Ignore non-video metadata. */ }
  }
  const article = items.find((item) => item['@type'] === 'NewsArticle')
  const video = items.find((item) => item['@type'] === 'VideoObject')
  if (!article || !video) return null
  const clip: MatchClip = { title: text(article.headline), date: text(video.uploadDate) || text(article.datePublished), source: 'Sky Sports', url, thumbnail: text(object(article.image).url) || undefined }
  return clipMatchesFixture(clip, fixture) ? clip : null
}

export function footballHighlightsProxy(searchKey: string): Plugin {
  let catalogue: { clips: MatchClip[]; expires: number } | undefined
  let catalogueRequest: Promise<MatchClip[]> | undefined
  const cache = new Map<string, { result: MatchClipResult; expires: number }>()
  const pending = new Map<string, Promise<MatchClipResult>>()
  let lookupTimes: number[] = []
  async function loadCatalogue() {
    if (catalogue && catalogue.expires > Date.now()) return catalogue.clips
    if (catalogueRequest) return catalogueRequest
    catalogueRequest = publicHtml('https://www.beinsports.com/en-mena/videos').then((html) => {
      const clips = beINClips(html)
      if (!clips.length) throw new Error('Video catalogue empty')
      catalogue = { clips, expires: Date.now() + 10 * 60_000 }
      return clips
    }).finally(() => { catalogueRequest = undefined })
    return catalogueRequest
  }
  async function lookup(fixture: VideoFixture): Promise<MatchClipResult> {
    let clips: MatchClip[] = []
    try { clips = await loadCatalogue() } catch { /* Try the exact match lookup. */ }
    const known = clips.find((clip) => clipMatchesFixture(clip, fixture))
    if (known) return { status: 'ready', clip: known }
    lookupTimes = lookupTimes.filter((time) => Date.now() - time < 60_000)
    if (!searchKey) return { status: 'unavailable', clip: null, message: 'A verified clip is not available for this match yet.' }
    if (lookupTimes.length >= 10) return { status: 'unavailable', clip: null, message: 'Clip lookup is busy. Please try again shortly.' }
    lookupTimes.push(Date.now())
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST', headers: { Authorization: `Bearer ${searchKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ query: `${fixture.home} ${fixture.away} ${fixture.score?.join('-')} ${fixture.date} match highlights`, include_domains: ['beinsports.com', 'skysports.com'], search_depth: 'basic', max_results: 8, include_answer: false }),
    })
    if (!response.ok) throw new Error('Clip lookup unavailable')
    const payload = await response.json() as { results?: SearchHit[] }
    const hits = (payload.results || []).flatMap((hit) => {
      try {
        const url = new URL(hit.url || '')
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return []
        if (url.hostname === 'www.beinsports.com' && url.pathname.includes('/articles-video/') && url.pathname.includes(fixture.date)) return [{ url: url.origin + url.pathname, source: 'bein' }]
        if (url.hostname === 'www.skysports.com' && /^\/football\/video\/\d+\//.test(url.pathname) && clipMatchesFixture({ title: hit.title || '', date: `${fixture.date}T12:00:00Z` }, fixture)) return [{ url: url.origin + url.pathname, source: 'sky' }]
      } catch { /* Reject untrusted destinations. */ }
      return []
    }).sort((a, b) => Number(a.source === 'sky') - Number(b.source === 'sky')).slice(0, 4)
    for (const hit of hits) {
      try {
        const html = await publicHtml(hit.url)
        const clip = hit.source === 'bein' ? beINClips(html).find((candidate) => clipMatchesFixture(candidate, fixture)) : skyClip(html, hit.url, fixture)
        if (clip) return { status: 'ready', clip }
      } catch { /* Try the next official clip. */ }
    }
    return { status: 'unavailable', clip: null, message: 'A verified clip is not available for this match yet.' }
  }
  const middleware = async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'Use GET.' })); return }
    try {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' })); return }
      const request = new URL(req.url || '/', 'http://localhost')
      const home = request.searchParams.get('home')?.trim() || ''
      const away = request.searchParams.get('away')?.trim() || ''
      const date = request.searchParams.get('date') || ''
      const scoreText = request.searchParams.get('score') || ''
      if (!request.pathname.endsWith('/match') || !home || !away || home.length > 100 || away.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !/^\d{1,2}-\d{1,2}$/.test(scoreText)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Valid fixture details are required.' })); return }
      const fixture: VideoFixture = { home, away, date, score: scoreText.split('-').map(Number) as [number, number] }
      const key = JSON.stringify(fixture)
      const cached = cache.get(key)
      if (cached && cached.expires > Date.now()) { res.end(JSON.stringify(cached.result)); return }
      let work = pending.get(key)
      if (!work) {
        work = lookup(fixture).catch((): MatchClipResult => ({ status: 'unavailable', clip: null, message: 'The video provider could not be reached. Please try again.' })).then((result) => {
          if (cache.size >= 300) cache.delete(cache.keys().next().value!)
          const ttl = result.clip ? 60 * 60_000 : result.message?.includes('busy') || result.message?.includes('could not be reached') ? 30_000 : 5 * 60_000
          cache.set(key, { result, expires: Date.now() + ttl })
          return result
        }).finally(() => { pending.delete(key) })
        pending.set(key, work)
      }
      res.setHeader('Cache-Control', 'private, max-age=30')
      res.end(JSON.stringify(await work))
    } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Clip lookup unavailable.' })) }
  }
  return { name: 'official-match-highlights', configureServer(server) { server.middlewares.use('/api/football-highlights', middleware) }, configurePreviewServer(server) { server.middlewares.use('/api/football-highlights', middleware) } }
}
