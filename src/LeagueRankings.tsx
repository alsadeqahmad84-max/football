import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import './leagueRankings.css'

export type StandingRow = {
  id: number | string
  rank: number
  name: string
  logo?: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  form?: string
}

export type ScorerRow = {
  id: number | string
  rank: number
  name: string
  photo?: string
  club: string
  clubLogo?: string
  goals: number
  assists?: number
  appearances?: number
  minutes?: number
}

export type LeagueRankingsProps = {
  league: { id: string; name: string; country: string; logo: string; accent: string; clubs: number }
  standings: StandingRow[]
  scorers: ScorerRow[]
  loading: boolean
  standingsNote: string
  scorersNote: string
  error?: string
  initialTab?: 'standings' | 'scorers'
}

type RankingsTab = 'standings' | 'scorers'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

function RankingsImage({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <span className={`pl-rankings-image ${className}`} aria-hidden="true">
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="pl-rankings-initials">{initials(name)}</span>}
  </span>
}

function RankingMark({ kind }: { kind: 'table' | 'scorers' }) {
  return kind === 'table' ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h16v16H4zM4 9h16M4 14h16M9 9v11" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a5 5 0 0 0 4 5m8-7h4v2a5 5 0 0 1-4 5m-4 0v5m-4 4h8m-6-4h4v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function DataNote({ note }: { note: string }) {
  return note ? <p className="pl-rankings-data-note"><span aria-hidden="true">i</span>{note}</p> : null
}

function RankingsPlaceholder({ kind, loading, note, error }: { kind: RankingsTab; loading: boolean; note: string; error?: string }) {
  if (loading) return <div className="pl-rankings-loading" role="status"><p>Loading {kind === 'standings' ? 'league standings' : 'top scorers'}…</p><div aria-hidden="true">{[1, 2, 3, 4, 5].map(item => <span key={item} />)}</div></div>
  return <div className="pl-rankings-empty" role="status"><span className="pl-rankings-empty-mark"><RankingMark kind={kind === 'standings' ? 'table' : 'scorers'} /></span><h3>{kind === 'standings' ? 'Standings are not available yet' : 'Scorer statistics are not available yet'}</h3><p>{note || error || 'The selected league has not published these statistics yet.'}</p></div>
}

function RecentForm({ form }: { form?: string }) {
  const results = (form ?? '').toUpperCase().replace(/[^WDL]/g, '').slice(-5).split('')
  const labels: Record<string, string> = { W: 'Win', D: 'Draw', L: 'Loss' }
  return results.length ? <span className="pl-rankings-form">{results.map((result, index) => <span key={index} className={`pl-rankings-form-${result.toLowerCase()}`} title={labels[result]} aria-label={labels[result]}>{result}</span>)}</span> : <span className="pl-rankings-dash" aria-label="Form unavailable">—</span>
}

function StandingsTable({ rows, leagueName }: { rows: StandingRow[]; leagueName: string }) {
  const showForm = rows.some(row => /[WDL]/i.test(row.form || ''))
  return <>
    <div className="pl-rankings-table-scroll" role="region" aria-label={`${leagueName} standings table. Scroll horizontally for all statistics.`} tabIndex={0}>
      <table className={`pl-rankings-table${showForm ? '' : ' pl-rankings-no-form'}`}>
        <caption className="pl-rankings-sr-only">{leagueName} league standings</caption>
        <thead><tr>
          <th scope="col" className="pl-rankings-club-cell">Club</th>
          <th scope="col"><abbr title="Matches played">P</abbr></th>
          <th scope="col"><abbr title="Matches won">W</abbr></th>
          <th scope="col"><abbr title="Matches drawn">D</abbr></th>
          <th scope="col"><abbr title="Matches lost">L</abbr></th>
          <th scope="col"><abbr title="Goals scored">GF</abbr></th>
          <th scope="col"><abbr title="Goals conceded">GA</abbr></th>
          <th scope="col"><abbr title="Goal difference">GD</abbr></th>
          {showForm && <th scope="col" className="pl-rankings-form-cell">Last 5</th>}
          <th scope="col" className="pl-rankings-points-cell"><abbr title="Points">Pts</abbr></th>
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className={row.rank === 1 ? 'pl-rankings-leader-row' : undefined}>
          <th scope="row" className="pl-rankings-club-cell"><div className="pl-rankings-club"><span className="pl-rankings-position">{row.rank}</span><RankingsImage src={row.logo} name={row.name} className="pl-rankings-badge" /><span className="pl-rankings-club-name" title={row.name}>{row.name}</span></div></th>
          <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td className="pl-rankings-goal-difference">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</td>
          {showForm && <td className="pl-rankings-form-cell"><RecentForm form={row.form} /></td>}<td className="pl-rankings-points-cell"><strong>{row.points}</strong></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="pl-rankings-table-key"><span><strong>P</strong> Played</span><span><strong>GD</strong> Goal difference</span>{showForm && <><span><i className="pl-rankings-form-w" /> Win</span><span><i className="pl-rankings-form-d" /> Draw</span><span><i className="pl-rankings-form-l" /> Loss</span><span>Last 5: latest on the right</span></>}<span className="pl-rankings-scroll-hint">Swipe for more stats →</span></p>
  </>
}

function ScorerStatistics({ player }: { player: ScorerRow }) {
  const minutesPerGoal = player.goals > 0 && player.minutes != null && player.minutes > 0 ? Math.round(player.minutes / player.goals) : undefined
  return <div className="pl-rankings-scorer-statistics">
    {player.assists != null && <span><strong>{player.assists}</strong> Assists</span>}
    {player.appearances != null && <span><strong>{player.appearances}</strong> Appearances</span>}
    {minutesPerGoal != null && <span><strong>{minutesPerGoal}</strong> Min / goal</span>}
  </div>
}

function ScorersList({ rows }: { rows: ScorerRow[] }) {
  const leader = rows[0]
  const highestGoals = Math.max(1, ...rows.map(row => row.goals))
  return <div className="pl-rankings-scorers">
    <section className="pl-rankings-featured-scorer" aria-label="Leading scorer">
      <div className="pl-rankings-featured-copy"><span className="pl-rankings-featured-label"><RankingMark kind="scorers" /> Leading scorer</span><h3>{leader.name}</h3><span className="pl-rankings-featured-club"><RankingsImage src={leader.clubLogo} name={leader.club} className="pl-rankings-badge" />{leader.club}</span><ScorerStatistics player={leader} /></div>
      <div className="pl-rankings-featured-goals"><strong>{leader.goals}</strong><span>{leader.goals === 1 ? 'Goal' : 'Goals'}</span></div>
      <RankingsImage src={leader.photo} name={leader.name} className="pl-rankings-featured-photo" />
    </section>
    <div className="pl-rankings-scorer-list-head" aria-hidden="true"><span>Player ranking</span><span>Goals</span></div>
    <ol className="pl-rankings-scorer-list">{rows.map(player => <li key={player.id} value={player.rank} className={player.rank === 1 ? 'pl-rankings-first-scorer' : undefined}>
      <span className="pl-rankings-scorer-rank" aria-label={`Rank ${player.rank}`}>{player.rank}</span>
      <RankingsImage src={player.photo} name={player.name} className="pl-rankings-player-photo" />
      <div className="pl-rankings-scorer-copy"><h3>{player.name}</h3><span className="pl-rankings-scorer-club"><RankingsImage src={player.clubLogo} name={player.club} className="pl-rankings-mini-badge" />{player.club}</span><ScorerStatistics player={player} /><span className="pl-rankings-goal-track" aria-hidden="true"><span style={{ width: `${player.goals / highestGoals * 100}%` }} /></span></div>
      <span className="pl-rankings-scorer-goals"><strong>{player.goals}</strong><small>{player.goals === 1 ? 'goal' : 'goals'}</small></span>
    </li>)}</ol>
  </div>
}

export default function LeagueRankings({ league, standings, scorers, loading, standingsNote, scorersNote, error, initialTab = 'standings' }: LeagueRankingsProps) {
  const [tab, setTab] = useState<RankingsTab>(initialTab)
  useEffect(() => setTab(initialTab), [initialTab])
  const id = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tabs: { id: RankingsTab; label: string; count: number; kind: 'table' | 'scorers' }[] = [
    { id: 'standings', label: 'Standings', count: standings.length, kind: 'table' },
    { id: 'scorers', label: 'Top scorers', count: scorers.length, kind: 'scorers' },
  ]
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined
    if (next == null) return
    event.preventDefault()
    setTab(tabs[next].id)
    tabRefs.current[next]?.focus()
  }
  return <section className="pl-rankings" style={{ '--rankings-accent': league.accent } as CSSProperties} aria-labelledby={`${id}-heading`}>
    <header className="pl-rankings-heading"><div><span className="pl-rankings-eyebrow">League rankings</span><h2 id={`${id}-heading`}>{league.name}</h2><p>{league.country} <span aria-hidden="true">·</span> Standings &amp; goalscorers</p></div><RankingsImage src={league.logo} name={league.name} className="pl-rankings-league-logo" /></header>
    <div className="pl-rankings-tabs" role="tablist" aria-label="League statistics">{tabs.map((item, index) => <button key={item.id} ref={node => { tabRefs.current[index] = node }} type="button" role="tab" id={`${id}-${item.id}-tab`} aria-controls={`${id}-${item.id}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => handleTabKey(event, index)}><RankingMark kind={item.kind} /><span>{item.label}</span>{item.count > 0 && <span className="pl-rankings-tab-count">{item.count}</span>}</button>)}</div>
    <div className="pl-rankings-panel" role="tabpanel" id={`${id}-standings-panel`} aria-labelledby={`${id}-standings-tab`} hidden={tab !== 'standings'} tabIndex={0}>
      {standings.length ? <><div className="pl-rankings-panel-intro"><div><h3>The league table</h3><p>{standings.length} clubs, every point matters.</p></div><span className="pl-rankings-count-label">{standings.length} clubs</span></div><StandingsTable rows={standings} leagueName={league.name} /><DataNote note={standingsNote} /></> : <RankingsPlaceholder kind="standings" loading={loading} note={standingsNote} error={error} />}
    </div>
    <div className="pl-rankings-panel" role="tabpanel" id={`${id}-scorers-panel`} aria-labelledby={`${id}-scorers-tab`} hidden={tab !== 'scorers'} tabIndex={0}>
      {scorers.length ? <><div className="pl-rankings-panel-intro"><div><h3>The goalscorers</h3><p>Scoring leaders across {league.name}.</p></div><span className="pl-rankings-count-label">{scorers.length} players</span></div><ScorersList rows={scorers} /><DataNote note={scorersNote} /></> : <RankingsPlaceholder kind="scorers" loading={loading} note={scorersNote} error={error} />}
    </div>
  </section>
}
