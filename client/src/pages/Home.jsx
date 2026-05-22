import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import SessionCard from '../components/SessionCard'
import { useMockApp } from '../context/MockAppContext'
import { useDbPlayerSummary } from '../hooks/useDbPlayerSummary'
import { safeNumber } from '../utils/safeNumber'
import { isPastSession } from '../utils/sessionPast'

function HomeBrand() {
  return (
    <header className="home-brand">
      <div className="home-brand__texture" aria-hidden="true" />
      <h1 className="home-brand__title">
        SIDE<span className="home-brand__title-accent">5</span>
      </h1>
      <p className="home-brand__tagline">
        Don&apos;t just sit. <span className="home-brand__tagline-accent">Run the game.</span>
      </p>
    </header>
  )
}

function HomeSectionHead({ icon, children }) {
  return (
    <div className="home-section-head">
      <span className="home-section-head__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="home-section-head__label">{children}</p>
    </div>
  )
}

function ProfileSummaryCard({
  timeGreeting,
  displayName,
  heroInitials,
  heroAvatarImage,
  heroWorth,
  heroOverall,
  heroArchetype,
  heroMvps,
  heroMatches,
  emptyState,
}) {
  return (
    <section className="card hero-card-main home-profile-card">
      <div className="hero-card-main__top">
        <div className="hero-card-main__identity">
          <div className="hero-card-main__avatar-wrap">
            <div className="avatar avatar-xl hero-card-main__avatar home-profile-card__avatar">
              {heroAvatarImage ? (
                <img src={heroAvatarImage} alt="" className="hero-card-main__avatar-image" />
              ) : (
                heroInitials
              )}
            </div>
            {safeNumber(heroMvps, 0) > 0 ? <span className="home-profile-card__mvp-badge">MVP</span> : null}
          </div>
          <div className="hero-card-main__identity-text">
            <p className="greeting-label">{timeGreeting}</p>
            <h2 className="hero-name home-profile-card__name">{displayName}</h2>
          </div>
        </div>

        <aside className="hero-card-main__worth">
          <p className="hero-card-main__worth-label">Total Worth</p>
          <p className="hero-card-main__worth-value">${safeNumber(heroWorth, 10).toFixed(1)}M</p>
          <p className="hero-card-main__ovr">OVR {safeNumber(heroOverall, 60)}</p>
          <svg className="hero-card-main__sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2 28 L24 26 L42 16 L62 18 L80 9 L98 3" />
          </svg>
        </aside>
      </div>

      <div className="hero-card-main__stats">
        <article className="hero-card-main__stat">
          <p className="hero-card-main__stat-label">Main Archetype</p>
          <p className="hero-card-main__stat-value">{heroArchetype}</p>
        </article>
        <article className="hero-card-main__stat">
          <p className="hero-card-main__stat-label">MVP Trophies</p>
          <p className="hero-card-main__stat-value">{safeNumber(heroMvps, 0)}</p>
        </article>
        <article className="hero-card-main__stat">
          <p className="hero-card-main__stat-label">Matches Played</p>
          <p className="hero-card-main__stat-value">{safeNumber(heroMatches, 0)}</p>
        </article>
      </div>

      {emptyState ? <p className="meta hero-card-main__empty-state">{emptyState}</p> : null}
    </section>
  )
}

function LeagueShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3 4 6.5v5.8c0 4.8 3.4 9.3 8 10.7 4.6-1.4 8-5.9 8-10.7V6.5L12 3Z" />
      <path d="M9.5 12.2 11.2 14l3.8-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Home() {
  const {
    sessions,
    matches,
    players,
    activeLeague,
    currentUser,
    myLeagueIds,
    joinLeague,
    canManageLeague,
    getLeaguePlayers,
    getPlayerIdentity,
  } = useMockApp()
  const [inviteHint, setInviteHint] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const [joinErr, setJoinErr] = useState('')
  const match = matches[0]
  const currentHour = new Date().getHours()
  const timeGreeting = currentHour < 12 ? 'Good morning,' : currentHour < 18 ? 'Good afternoon,' : 'Good evening,'

  const inAnyLeague = myLeagueIds.length > 0
  const numericUserId = Number.parseInt(String(currentUser?.id ?? ''), 10)
  const isDbUser = !Number.isNaN(numericUserId) && String(numericUserId) === String(currentUser?.id ?? '')
  const { summary: dbSummary } = useDbPlayerSummary(
    isDbUser ? numericUserId : null,
    activeLeague?.id,
    isDbUser && Boolean(currentUser?.id),
  )

  const nextSession =
    sessions
      .filter((s) => !isPastSession(s))
      .sort((a, b) => `${a.dateIso}T${a.time24}`.localeCompare(`${b.dateIso}T${b.time24}`))[0] ?? sessions[0]

  const copyInvite = async () => {
    if (!activeLeague?.inviteCode) return
    try {
      await navigator.clipboard.writeText(activeLeague.inviteCode)
      setInviteHint('Copied invite code')
    } catch {
      setInviteHint(activeLeague.inviteCode)
    }
    setTimeout(() => setInviteHint(''), 2500)
  }

  const handleJoinInline = async () => {
    setJoinErr('')
    setJoinMsg('')
    const result = await joinLeague(joinCode)
    if (!result.ok) {
      setJoinErr(result.reason)
      return
    }
    const joinedName = result.league?.name ?? 'the league'
    setJoinMsg(`Joined ${joinedName}.`)
    setJoinCode('')
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  const fallbackMe = {
    id: String(currentUser.playerId ?? `home-${currentUser.id}`),
    value: 10,
    rating: 7,
    overall: 70,
    mvps: 0,
  }
  const leaguePlayers = activeLeague ? getLeaguePlayers(activeLeague.id) : players
  const meBase =
    leaguePlayers.find((player) => player.id === currentUser.playerId) ??
    players.find((player) => player.id === currentUser.playerId) ??
    fallbackMe
  const me = {
    ...meBase,
    games: safeNumber(dbSummary?.matches_played ?? meBase.games, 0),
    rating: safeNumber(dbSummary?.rating ?? meBase.rating, 6),
    value: safeNumber(dbSummary?.player_worth ?? dbSummary?.total_worth ?? meBase.value, 10),
    overall: safeNumber(
      dbSummary?.ovr ?? meBase.overall,
      Math.round(safeNumber(dbSummary?.rating ?? meBase.rating, 6) * 10),
    ),
    mvps: safeNumber(dbSummary?.mvp_trophies ?? meBase.mvps, 0),
  }
  const identity = getPlayerIdentity(me.id, activeLeague?.id ?? null)
  const heroOverall = safeNumber(dbSummary?.ovr ?? me.overall, me.overall)
  const heroInitials =
    currentUser.initials ||
    String(currentUser.displayName || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') ||
    'P'
  const heroArchetype = dbSummary?.main_archetype || (identity.hasVotes ? identity.mainArchetype : 'None')
  const heroWorth = safeNumber(dbSummary?.player_worth ?? dbSummary?.total_worth ?? me.value, 10)
  const heroMvps = safeNumber(dbSummary?.mvp_trophies ?? me.mvps, 0)
  const heroMatches = safeNumber(dbSummary?.matches_played ?? me.games, 0)
  const heroAvatarImage = currentUser.avatarImage || dbSummary?.avatar_image || ''

  const profileCard = (
    <ProfileSummaryCard
      timeGreeting={timeGreeting}
      displayName={currentUser.displayName}
      heroInitials={heroInitials}
      heroAvatarImage={heroAvatarImage}
      heroWorth={heroWorth}
      heroOverall={heroOverall}
      heroArchetype={heroArchetype}
      heroMvps={heroMvps}
      heroMatches={heroMatches}
    />
  )

  if (!inAnyLeague) {
    return (
      <div className="screen home-screen">
        <HomeBrand />
        <ProfileSummaryCard
          timeGreeting={timeGreeting}
          displayName={currentUser.displayName}
          heroInitials={heroInitials}
          heroAvatarImage={heroAvatarImage}
          heroWorth={heroWorth}
          heroOverall={heroOverall}
          heroArchetype={heroArchetype}
          heroMvps={heroMvps}
          heroMatches={heroMatches}
          emptyState="You are not in a league yet. Join with a code or create your own."
        />

        <HomeSectionHead
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 3 4 6.5v5.8c0 4.8 3.4 9.3 8 10.7 4.6-1.4 8-5.9 8-10.7V6.5L12 3Z" />
            </svg>
          }
        >
          Join a league
        </HomeSectionHead>
        <section className="card home-join-card">
          <p className="meta">Ask your organizer for an invite code.</p>
          <label className="field">
            <span className="field-label">Invite code</span>
            <input
              className="field-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="SIDE5-MON"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {joinErr ? <p className="form-error">{joinErr}</p> : null}
          {joinMsg ? <p className="meta toast-hint">{joinMsg}</p> : null}
          <PrimaryButton type="button" className="w-full" onClick={handleJoinInline}>
            Join League
          </PrimaryButton>
        </section>

        <HomeSectionHead
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
              <circle cx="12" cy="8" r="3" />
            </svg>
          }
        >
          League
        </HomeSectionHead>
        <Link to="/league" className="w-full">
          <SecondaryButton type="button" className="w-full">
            Open League
          </SecondaryButton>
        </Link>
      </div>
    )
  }

  return (
    <div className="screen home-screen">
      <HomeBrand />
      {profileCard}

      {activeLeague ? (
        <>
          <HomeSectionHead icon={<LeagueShieldIcon />}>Your League</HomeSectionHead>
          <section className="card home-league-card">
            <div className="home-dashboard-card__body">
              <div className="home-dashboard-card__icon home-dashboard-card__icon--league" aria-hidden="true">
                <LeagueShieldIcon />
              </div>
              <div className="home-dashboard-card__content">
                <p className="home-dashboard-card__title">{activeLeague.name}</p>
                <p className="home-dashboard-card__meta">
                  {activeLeague.memberCount} players · {activeLeague.sessionCount} sessions
                </p>
                <p className="home-dashboard-card__meta home-dashboard-card__meta--accent">
                  Invite code: <span className="invite-code">{activeLeague.inviteCode}</span>
                </p>
              </div>
            </div>
            {inviteHint ? <p className="meta toast-hint">{inviteHint}</p> : null}
            <div className="button-row home-card-actions">
              <Link to="/league" className="w-full">
                <SecondaryButton className="w-full home-btn-secondary">
                  <span className="home-btn__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
                      <circle cx="12" cy="8" r="3" />
                    </svg>
                  </span>
                  View League
                </SecondaryButton>
              </Link>
              {canManageLeague(activeLeague.id) ? (
                <PrimaryButton type="button" className="w-full home-btn-primary" onClick={copyInvite}>
                  <span className="home-btn__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                  Invite Player
                </PrimaryButton>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      <HomeSectionHead
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="4" y="5" width="16" height="14" rx="2.5" />
            <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" strokeLinecap="round" />
          </svg>
        }
      >
        Next Game
      </HomeSectionHead>
      {nextSession ? (
        <SessionCard session={nextSession} showLeague variant="dashboard" />
      ) : (
        <p className="meta home-empty-hint">No upcoming sessions.</p>
      )}

      <HomeSectionHead
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" strokeLinejoin="round" />
          </svg>
        }
      >
        Quick Actions
      </HomeSectionHead>
      <div className="home-quick-actions">
        <Link to="/league" className="home-quick-action-card">
          <span className="home-quick-action-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 6h8M6 10h12M8 14h8M10 18h4" strokeLinecap="round" />
              <path d="M12 3v3M9 21h6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="home-quick-action-card__text">
            <span className="home-quick-action-card__title">League Hub</span>
            <span className="home-quick-action-card__subtitle">Manage your league</span>
          </span>
        </Link>
        {activeLeague && canManageLeague(activeLeague.id) ? (
          <Link to="/sessions?new=1" className="home-quick-action-card">
            <span className="home-quick-action-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="5" width="16" height="14" rx="2.5" />
                <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16M12 13v4M10 15h4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="home-quick-action-card__text">
              <span className="home-quick-action-card__title">Create Session</span>
              <span className="home-quick-action-card__subtitle">Set up a new game</span>
            </span>
          </Link>
        ) : null}
      </div>

      <section className="card home-footer-card" aria-label="Motivation">
        <span className="home-footer-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 9a6 6 0 1 1 12 0v1.2c0 1.5.6 2.9 1.7 4L18 18H6l-1.3-3.8A5.2 5.2 0 0 1 6 10.2V9Z" />
            <path d="M9 21h6" strokeLinecap="round" />
          </svg>
        </span>
        <p className="home-footer-card__text">
          Great teams play together. <span className="home-footer-card__accent">Legends run the game.</span>
        </p>
      </section>

      {match ? (
        <>
          <HomeSectionHead
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 9h12v10H6z" />
                <path d="M9 9V7a3 3 0 1 1 6 0v2" strokeLinecap="round" />
              </svg>
            }
          >
            Recent Result
          </HomeSectionHead>
          <section className="card">
            <p className="meta">
              {match.date} · {match.time}
            </p>
            <div className="result-grid">
              <span className="team-name">Team A</span>
              <span className="scoreline">
                {match.homeScore} - {match.awayScore}
              </span>
              <span className="team-name text-right">Team B</span>
            </div>
            <p className="meta">
              MVP: {players.find((p) => p.id === match.mvpPlayerId)?.name ?? '—'}{' '}
              {players.find((p) => p.id === match.mvpPlayerId)?.rating?.toFixed(1) ?? ''}
            </p>
            <Link to={`/matches/${match.id}`}>
              <PrimaryButton className="w-full">View Match Details</PrimaryButton>
            </Link>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default Home
