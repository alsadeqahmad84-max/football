import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import './leagueCoaches.css'

export type CoachRecord = {
  id: string | number
  name: string
  club: string
  clubId?: string | number
  clubLogo?: string
  photo?: string
  nationality?: string
  age?: number
  appointedAt?: string
  profileUrl?: string
}

export type LeagueCoachesProps = {
  league: { id: string; name: string; country: string; logo: string; accent: string; clubs: number }
}

type CoachResponse = {
  coaches: CoachRecord[]
  source?: string
  sourceUrl?: string
  updatedAt?: string
  error?: string
  message?: string
}

type CoachState = CoachResponse & { leagueId: string; loading: boolean; refreshFailed?: boolean }

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

function safeWebUrl(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

function safeImageUrl(value?: string) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : safeWebUrl(value)
}

function CoachImage({ src, name, kind }: { src?: string; name: string; kind: 'portrait' | 'badge' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const imageUrl = safeImageUrl(src)
  return <span className={`pl-coaches-image pl-coaches-${kind}`} aria-hidden="true">
    {imageUrl && !failed ? <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span className="pl-coaches-initials">{initials(name)}</span>}
  </span>
}

function CoachesMark() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4h5v12h-5M18 8h1M18 12h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function RefreshMark() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.5 6.5A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function readableDate(value?: string, includeTime = false) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat(undefined, includeTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { month: 'short', year: 'numeric' }).format(date)
}

function CoachCard({ coach, clubPage }: { coach: CoachRecord; clubPage: boolean }) {
  const appointed = readableDate(coach.appointedAt)
  const profileUrl = safeWebUrl(coach.profileUrl)
  return <li className="pl-coaches-card">
    <div className="pl-coaches-card-top"><span className="pl-coaches-role">Head coach</span><CoachImage src={coach.clubLogo} name={coach.club} kind="badge" /></div>
    <div className="pl-coaches-card-person"><CoachImage src={coach.photo} name={coach.name} kind="portrait" /><div className="pl-coaches-card-copy"><h3>{coach.name}</h3><p>{coach.club}</p></div></div>
    {(coach.nationality || (typeof coach.age === 'number' && coach.age > 0) || appointed) && <dl className="pl-coaches-details">
      {coach.nationality && <div><dt>Nationality</dt><dd>{coach.nationality}</dd></div>}
      {typeof coach.age === 'number' && coach.age > 0 && <div><dt>Age</dt><dd>{coach.age}</dd></div>}
      {appointed && <div><dt>Appointed</dt><dd><time dateTime={coach.appointedAt}>{appointed}</time></dd></div>}
    </dl>}
    {profileUrl && <a className="pl-coaches-profile" href={profileUrl} target="_blank" rel="noopener noreferrer" aria-label={`${clubPage ? `View ${coach.club}'s official club page` : `View ${coach.name}'s coach profile`} (opens in a new tab)`}>{clubPage ? 'Club page' : 'Coach profile'} <span aria-hidden="true">↗</span></a>}
  </li>
}

export default function LeagueCoaches({ league }: LeagueCoachesProps) {
  const headingId = useId()
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState<CoachState>({ leagueId: league.id, coaches: [], loading: true })

  useEffect(() => { setQuery('') }, [league.id])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState(previous => previous.leagueId === league.id ? { ...previous, loading: true, error: undefined, refreshFailed: false } : { leagueId: league.id, coaches: [], loading: true })
    async function load() {
      try {
        const response = await fetch(`/api/league-coaches?league=${encodeURIComponent(league.id)}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
        const payload = await response.json().catch(() => null) as CoachResponse | null
        if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Coach details could not be loaded. Please try again.')
        if (!payload || !Array.isArray(payload.coaches)) throw new Error('Coach details are temporarily unavailable. Please try again.')
        const coaches = payload.coaches.filter(coach => coach && typeof coach.name === 'string' && coach.name.trim() && typeof coach.club === 'string' && coach.club.trim())
        if (active) setState({ leagueId: league.id, loading: false, coaches, source: typeof payload.source === 'string' ? payload.source : undefined, sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : undefined, updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined, message: typeof payload.message === 'string' ? payload.message : undefined, error: typeof payload.error === 'string' ? payload.error : undefined })
      } catch (error) {
        if (!active || controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'Coach details could not be loaded. Please try again.'
        setState(previous => ({ ...(previous.leagueId === league.id ? previous : { leagueId: league.id, coaches: [] }), loading: false, error: message, refreshFailed: previous.leagueId === league.id && previous.coaches.length > 0 }))
      }
    }
    void load()
    return () => { active = false; controller.abort() }
  }, [league.id, refresh])

  const visibleState: CoachState = state.leagueId === league.id ? state : { leagueId: league.id, coaches: [], loading: true }
  const coaches = visibleState.coaches
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return [...coaches].filter(coach => !search || `${coach.name} ${coach.club}`.toLocaleLowerCase().includes(search)).sort((left, right) => left.club.localeCompare(right.club))
  }, [coaches, query])
  const clubCount = new Set(coaches.map(coach => coach.clubId ?? coach.club)).size
  const updated = readableDate(visibleState.updatedAt, true)
  const sourceUrl = safeWebUrl(visibleState.sourceUrl)

  return <section className="pl-coaches" style={{ '--coaches-accent': league.accent } as CSSProperties} aria-labelledby={headingId}>
    <header className="pl-coaches-heading"><div><span className="pl-coaches-eyebrow"><CoachesMark /> The people behind the teams</span><h2 id={headingId}>Team coaches</h2><p>{league.name} <span aria-hidden="true">·</span> {league.country}</p></div><CoachImage src={league.logo} name={league.name} kind="badge" /></header>
    <div className="pl-coaches-toolbar"><div className="pl-coaches-intro"><h3>The touchline</h3><p>{coaches.length ? `${clubCount} of ${league.clubs} clubs represented` : 'Explore the coaches behind each club.'}</p></div><div className="pl-coaches-controls"><label className="pl-coaches-search" htmlFor={searchId}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg><span className="pl-coaches-sr-only">Search coaches or clubs</span><input id={searchId} type="search" placeholder="Search coach or club" value={query} onChange={event => setQuery(event.target.value)} disabled={!coaches.length} /></label><button type="button" className="pl-coaches-refresh" onClick={() => setRefresh(value => value + 1)} disabled={visibleState.loading}><RefreshMark />{visibleState.loading ? 'Loading…' : 'Refresh'}</button></div></div>
    {visibleState.error && <p className="pl-coaches-notice pl-coaches-error" role="alert">{visibleState.refreshFailed && <strong>Refresh unavailable. Showing the last loaded coaches. </strong>}{visibleState.error}</p>}
    {visibleState.message && coaches.length > 0 && <p className="pl-coaches-notice" role="status">{visibleState.message}</p>}
    {visibleState.loading && <p className="pl-coaches-status" role="status">{coaches.length ? 'Updating coach details…' : `Loading ${league.name} coaches…`}</p>}
    {coaches.length > 0 ? <><p className="pl-coaches-results" role="status">{query.trim() ? `${filtered.length} ${filtered.length === 1 ? 'coach' : 'coaches'} found` : `${coaches.length} ${coaches.length === 1 ? 'coach' : 'coaches'}`}</p>{filtered.length ? <ul className="pl-coaches-grid">{filtered.map(coach => <CoachCard key={`${coach.clubId ?? coach.club}-${coach.id ?? coach.name}`} coach={coach} clubPage={league.id !== 'premier'} />)}</ul> : <div className="pl-coaches-empty"><CoachesMark /><h3>No matching coaches</h3><p>Try another coach name or club.</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div>}</> : visibleState.loading ? <div className="pl-coaches-grid pl-coaches-skeleton" aria-hidden="true">{[1, 2, 3, 4, 5, 6].map(item => <span key={item}><i /><i /><i /></span>)}</div> : <div className="pl-coaches-empty"><CoachesMark /><h3>Coach details are unavailable</h3><p>{visibleState.message || 'Current coach details for this league have not been returned. Try refreshing in a moment.'}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
    {(visibleState.source || updated) && <footer className="pl-coaches-source"><span>{visibleState.source && <>Source: {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{visibleState.source}<span className="pl-coaches-sr-only"> (opens in a new tab)</span></a> : visibleState.source}</>}</span>{updated && <span>Updated <time dateTime={visibleState.updatedAt}>{updated}</time></span>}</footer>}
  </section>
}
