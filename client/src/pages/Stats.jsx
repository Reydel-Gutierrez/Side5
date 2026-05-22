import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMockApp } from '../context/MockAppContext'
import { fetchLeaderboardFromApi, mapApiLeaderboardPlayer } from '../utils/leaderboardApi'

const LEADERBOARD_TABS = [
  { id: 'rating', label: 'Rating' },
  { id: 'goals', label: 'Goals' },
  { id: 'mvp', label: 'MVP' },
  { id: 'matches', label: 'Matches' },
]

function initialsFromName(name) {
  return (
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function formatRating(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number(value).toFixed(1)
}

function normalizePlayer(raw) {
  return {
    id: raw.id,
    name: raw.name,
    initials: raw.initials || initialsFromName(raw.name),
    rating: Number(raw.rating) || 6,
    matchesPlayed: Number(raw.matchesPlayed) || 0,
    goals: Number(raw.goals) || 0,
    wins: Number(raw.wins) || 0,
    losses: Number(raw.losses) || 0,
    mvp: Number(raw.mvp) || 0,
  }
}

function sortValueFor(player, sortKey) {
  if (sortKey === 'rating') return player.rating
  if (sortKey === 'mvp') return player.mvp
  if (sortKey === 'goals') return player.goals
  if (sortKey === 'matches') return player.matchesPlayed
  return 0
}

function rankPlayers(players, sortKey) {
  const sorted = [...players].sort((a, b) => {
    const diff = sortValueFor(b, sortKey) - sortValueFor(a, sortKey)
    if (diff !== 0) return diff
    if (sortKey !== 'rating') return b.rating - a.rating
    return b.goals - a.goals
  })
  return sorted
}

/** Desktop grid order: active sort column last (rightmost). Rank=1, player=2. */
const DESKTOP_COLUMN_ORDER = {
  rating: { rating: 7, matches: 3, goals: 4, wl: 5, mvp: 6 },
  goals: { rating: 3, matches: 4, goals: 7, wl: 5, mvp: 6 },
  mvp: { rating: 3, matches: 4, goals: 5, wl: 6, mvp: 7 },
  matches: { rating: 3, matches: 7, goals: 4, wl: 5, mvp: 6 },
}

function featuredStatFor(player, sortKey) {
  if (sortKey === 'goals') return { label: 'Goals', value: String(player.goals) }
  if (sortKey === 'mvp') return { label: 'MVP', value: String(player.mvp) }
  if (sortKey === 'matches') return { label: 'MP', value: String(player.matchesPlayed) }
  return { label: 'Rating', value: formatRating(player.rating) }
}

function computeSummary(players) {
  if (!players.length) {
    return { playerCount: 0, matchCount: 0, avgRating: '—', mvpTotal: 0 }
  }
  const playerCount = players.length
  const matchCount = Math.max(0, ...players.map((p) => p.matchesPlayed))
  const avgRating = players.reduce((sum, p) => sum + p.rating, 0) / playerCount
  const mvpTotal = players.reduce((sum, p) => sum + p.mvp, 0)
  return {
    playerCount,
    matchCount,
    avgRating: formatRating(avgRating),
    mvpTotal,
  }
}

function LeaderboardIcon({ name }) {
  if (name === 'users') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'star') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.8 6.4 20.5l2.1-6.7L3 9.8h6.8L12 3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    )
  }
  if (name === 'trophy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6h8v3a4 4 0 0 1-8 0V6Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 6H4v1a2 2 0 0 0 2 2M18 6h2v1a2 2 0 0 1-2 2M12 13v3M9 20h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 3v6c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V6l7-3Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  if (name === 'crown') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 16h14l-1.2-7.2-2.8 3.4-3-5.8-3 5.8-2.8-3.4L5 16Z" fill="currentColor" opacity="0.9" />
        <path d="M6 16v3h12v-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'info') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 10v6M12 8h.01" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  return null
}

function LeaderboardHero({ leagueName, contextNote }) {
  return (
    <section className="lb-hero" aria-labelledby="lb-page-title">
      <div className="lb-hero__bg" aria-hidden="true">
        <div className="lb-hero__ball" />
      </div>
      <div className="lb-hero__content">
        <div className="lb-hero__top">
          <div>
            <h1 id="lb-page-title" className="lb-hero__title">
              Leaderboard
            </h1>
            <p className="lb-hero__subtitle">
              League stats come from your league roster. New players start at 6.0 until they play a match.
            </p>
          </div>
          {leagueName ? (
            <span className="lb-hero__league-chip">
              <LeaderboardIcon name="shield" />
              <span>{leagueName}</span>
            </span>
          ) : null}
        </div>
        {contextNote ? <p className="lb-hero__note">{contextNote}</p> : null}
      </div>
    </section>
  )
}

function SummaryCards({ summary }) {
  const cards = [
    { id: 'players', label: 'Players', value: summary.playerCount, sub: 'Total Players', icon: 'users' },
    { id: 'matches', label: 'Matches Played', value: summary.matchCount, sub: 'Total Matches', icon: 'calendar' },
    { id: 'rating', label: 'Avg Rating', value: summary.avgRating, sub: 'League Average', icon: 'star' },
    { id: 'mvp', label: 'MVP Awarded', value: summary.mvpTotal, sub: 'Total MVPs', icon: 'trophy' },
  ]

  return (
    <div className="lb-summary-grid">
      {cards.map((card) => (
        <article key={card.id} className="lb-summary-card">
          <span className="lb-summary-card__icon">
            <LeaderboardIcon name={card.icon} />
          </span>
          <p className="lb-summary-card__label">{card.label}</p>
          <p className="lb-summary-card__value">{card.value}</p>
          <p className="lb-summary-card__sub">{card.sub}</p>
        </article>
      ))}
    </div>
  )
}

function LeaderboardPillTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="lb-toolbar">
      <div className="lb-pill-tabs" role="tablist" aria-label="Leaderboard sort">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`lb-pill-tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <span className="lb-filter-chip">All Players</span>
    </div>
  )
}

function LeaderboardRow({ player, rank, sortKey, isTop }) {
  const columnOrder = DESKTOP_COLUMN_ORDER[sortKey] ?? DESKTOP_COLUMN_ORDER.rating
  const featured = featuredStatFor(player, sortKey)
  const ratingIsSecondary = sortKey !== 'rating'
  const statClass = (key) => (sortKey === key ? ' lb-stat--active' : '')

  const compactParts = []
  if (ratingIsSecondary) {
    compactParts.push(
      <span key="rtg" className="is-secondary">
        RTG {formatRating(player.rating)}
      </span>,
    )
  }
  if (sortKey !== 'matches') {
    if (compactParts.length) compactParts.push(<span key="d1" className="lb-row__stats-dot" aria-hidden="true">•</span>)
    compactParts.push(<span key="mp">MP {player.matchesPlayed}</span>)
  }
  if (sortKey !== 'goals') {
    if (compactParts.length) compactParts.push(<span key="d2" className="lb-row__stats-dot" aria-hidden="true">•</span>)
    compactParts.push(<span key="g">G {player.goals}</span>)
  }
  if (compactParts.length) compactParts.push(<span key="d3" className="lb-row__stats-dot" aria-hidden="true">•</span>)
  compactParts.push(
    <span key="wl">
      W-L {player.wins}-{player.losses}
    </span>,
  )
  if (sortKey !== 'mvp') {
    compactParts.push(<span key="d4" className="lb-row__stats-dot" aria-hidden="true">•</span>)
    compactParts.push(<span key="mvp">MVP {player.mvp}</span>)
  }

  return (
    <li className={`lb-row${isTop ? ' lb-row--top' : ''}`} data-sort={sortKey}>
      <div className="lb-row__rank" style={{ order: 1 }}>
        {isTop ? (
          <span className="lb-row__crown" aria-hidden="true">
            <LeaderboardIcon name="crown" />
          </span>
        ) : null}
        <span className="lb-row__rank-num">{rank}</span>
      </div>

      <Link to={`/players/${player.id}`} className="lb-row__player" style={{ order: 2 }}>
        <span className="avatar lb-row__avatar">{player.initials}</span>
        <span className="lb-row__name">{player.name}</span>
      </Link>

      <div className="lb-row__featured" aria-label={`${featured.label} ${featured.value}`}>
        <span className="lb-row__featured-label">{featured.label}</span>
        <span className="lb-row__featured-value">{featured.value}</span>
      </div>

      <div
        className={`lb-row__rating${ratingIsSecondary ? ' is-secondary' : ' is-active'}`}
        style={{ order: columnOrder.rating }}
      >
        <span className="lb-row__rating-label">Rating</span>
        <span className="lb-row__rating-value">{formatRating(player.rating)}</span>
      </div>

      <div
        className={`lb-row__stat lb-row__stat--mp${statClass('matches')}`}
        style={{ order: columnOrder.matches }}
      >
        <span className="lb-row__stat-label">MP</span>
        <span className="lb-row__stat-value">{player.matchesPlayed}</span>
      </div>
      <div
        className={`lb-row__stat lb-row__stat--g${statClass('goals')}`}
        style={{ order: columnOrder.goals }}
      >
        <span className="lb-row__stat-label">G</span>
        <span className="lb-row__stat-value">{player.goals}</span>
      </div>
      <div className="lb-row__stat lb-row__stat--wl" style={{ order: columnOrder.wl }}>
        <span className="lb-row__stat-label">W-L</span>
        <span className="lb-row__stat-value">
          {player.wins}-{player.losses}
        </span>
      </div>
      <div
        className={`lb-row__stat lb-row__stat--mvp${statClass('mvp')}`}
        style={{ order: columnOrder.mvp }}
      >
        <span className="lb-row__stat-label">MVP</span>
        <span className="lb-row__stat-value">{player.mvp}</span>
      </div>

      <p
        className="lb-row__stats-compact"
        aria-label={`${formatRating(player.rating)} rating, ${player.matchesPlayed} matches, ${player.goals} goals, ${player.wins}-${player.losses} record, ${player.mvp} MVPs`}
      >
        {compactParts}
      </p>
    </li>
  )
}

function LeaderboardList({ players, sortKey }) {
  const rows = useMemo(() => rankPlayers(players, sortKey), [players, sortKey])
  const columnOrder = DESKTOP_COLUMN_ORDER[sortKey] ?? DESKTOP_COLUMN_ORDER.rating

  return (
    <div className={`lb-panel lb-panel--sort-${sortKey}`} role="tabpanel">
      <div className="lb-panel__head" aria-hidden="true">
        <span style={{ order: 1 }}>#</span>
        <span style={{ order: 2 }}>Player</span>
        <span className={sortKey === 'rating' ? 'is-active' : ''} style={{ order: columnOrder.rating }}>
          Rating
        </span>
        <span className={sortKey === 'matches' ? 'is-active' : ''} style={{ order: columnOrder.matches }}>
          MP
        </span>
        <span className={sortKey === 'goals' ? 'is-active' : ''} style={{ order: columnOrder.goals }}>
          G
        </span>
        <span style={{ order: columnOrder.wl }}>W-L</span>
        <span className={sortKey === 'mvp' ? 'is-active' : ''} style={{ order: columnOrder.mvp }}>
          MVP
        </span>
      </div>
      <ul className="lb-list">
        {rows.map((player, index) => (
          <LeaderboardRow
            key={player.id}
            player={player}
            rank={index + 1}
            sortKey={sortKey}
            isTop={index === 0}
          />
        ))}
      </ul>
    </div>
  )
}

function LeaderboardLoading() {
  return (
    <div className="lb-loading" aria-busy="true" aria-live="polite">
      <div className="lb-summary-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="lb-summary-card lb-summary-card--skeleton" />
        ))}
      </div>
      <div className="card lb-panel-card">
        <div className="lb-skeleton lb-skeleton--tabs" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="lb-skeleton lb-skeleton--row" />
        ))}
      </div>
      <p className="meta lb-loading-note">Loading leaderboard…</p>
    </div>
  )
}

function Stats() {
  const { activeLeague, activeLeagueId, currentUserId, refreshLeaguesFromApi } = useMockApp()
  const [players, setPlayers] = useState([])
  const [leagueName, setLeagueName] = useState(null)
  const [activeTab, setActiveTab] = useState('rating')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [contextNote, setContextNote] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async (showLoading = true) => {
      if (showLoading) setIsLoading(true)
      setError('')
      setContextNote('')

      try {
        await refreshLeaguesFromApi()
        if (cancelled) return

        const payload = await fetchLeaderboardFromApi({
          activeLeagueId: activeLeague?.id ?? activeLeagueId,
          userId: currentUserId,
        })
        if (cancelled) return

        const rawPlayers = payload?.data?.players
        const list = Array.isArray(rawPlayers)
          ? rawPlayers.map((row) => normalizePlayer(mapApiLeaderboardPlayer(row)))
          : []

        setPlayers(list)
        setLeagueName(payload?.data?.league_name ?? activeLeague?.name ?? null)

        if (payload?.data?.league_id == null) {
          setContextNote('Join a league to see league-specific stats.')
        }
      } catch (requestError) {
        if (cancelled) return
        setError(requestError.message || 'Failed to load leaderboard.')
        setPlayers([])
        setLeagueName(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run(true)

    const intervalId = window.setInterval(() => run(false), 15000)

    const onFocus = () => {
      if (!cancelled) run(false)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) run(false)
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeLeague?.id, activeLeagueId, currentUserId, refreshLeaguesFromApi])

  const summary = useMemo(() => computeSummary(players), [players])

  return (
    <div className="screen lb-page">
      <LeaderboardHero leagueName={leagueName} contextNote={contextNote} />

      {isLoading ? (
        <LeaderboardLoading />
      ) : (
        <>
          <SummaryCards summary={summary} />

          <section className="card lb-panel-card">
            <LeaderboardPillTabs tabs={LEADERBOARD_TABS} activeTab={activeTab} onChange={setActiveTab} />

            {error ? (
              <p className="lb-empty lb-empty--error" role="alert">
                {error}
              </p>
            ) : players.length === 0 ? (
              <div className="lb-empty">
                <span className="lb-empty__icon">
                  <LeaderboardIcon name="users" />
                </span>
                <p className="lb-empty__title">No players yet</p>
                <p className="meta">Join a league or add players to your roster to see the leaderboard.</p>
              </div>
            ) : (
              LEADERBOARD_TABS.map((tab) =>
                activeTab === tab.id ? <LeaderboardList key={tab.id} players={players} sortKey={tab.id} /> : null,
              )
            )}
          </section>

          <p className="lb-footer-note">
            <span className="lb-footer-note__icon" aria-hidden="true">
              <LeaderboardIcon name="info" />
            </span>
            New players start at 6.0 until they play a match.
          </p>
        </>
      )}
    </div>
  )
}

export default Stats
