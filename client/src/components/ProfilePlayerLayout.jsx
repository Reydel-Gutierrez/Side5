import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlayerRadarChart from './PlayerRadarChart'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import Tabs from './Tabs'

const profileTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'account', label: 'Account' },
]

function ProfileSectionHead({ icon, children }) {
  return (
    <div className="home-section-head profile-section-head">
      <span className="home-section-head__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="home-section-head__label">{children}</p>
    </div>
  )
}

function StatMini({ label, value }) {
  return (
    <article className="profile-stat-card">
      <p className="profile-stat-card__label">{label}</p>
      <p className="profile-stat-card__value">{value}</p>
    </article>
  )
}

function ProfileHeroCard({ profileCardData, player }) {
  const showMvpBadge = Number(profileCardData.mvpTrophies) > 0
  const canChangeAvatar = Boolean(profileCardData.onAvatarClick)

  return (
    <section className="card hero-card-main home-profile-card profile-hero-card">
      <div className="hero-card-main__top">
        <div className="hero-card-main__identity">
          <div className="hero-card-main__avatar-wrap">
            {canChangeAvatar ? (
              <button
                type="button"
                className="hero-card-main__avatar-button profile-hero-card__avatar-button"
                onClick={profileCardData.onAvatarClick}
                aria-label="Change profile picture"
              >
                <div className="avatar avatar-xl hero-card-main__avatar home-profile-card__avatar">
                  {profileCardData.avatarImage ? (
                    <img src={profileCardData.avatarImage} alt="" className="hero-card-main__avatar-image" />
                  ) : (
                    profileCardData.avatarFallback || player.initials
                  )}
                </div>
              </button>
            ) : (
              <div className="avatar avatar-xl hero-card-main__avatar home-profile-card__avatar">
                {profileCardData.avatarImage ? (
                  <img src={profileCardData.avatarImage} alt="" className="hero-card-main__avatar-image" />
                ) : (
                  profileCardData.avatarFallback || player.initials
                )}
              </div>
            )}
            {showMvpBadge ? <span className="home-profile-card__mvp-badge">MVP</span> : null}
            {canChangeAvatar ? (
              <span className="profile-hero-card__edit-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : null}
          </div>
          <div className="hero-card-main__identity-text">
            <p className="greeting-label">{profileCardData.greeting}</p>
            <h1 className="hero-name home-profile-card__name">{profileCardData.displayName || player.name}</h1>
            {profileCardData.avatarHint ? <p className="meta toast-hint">{profileCardData.avatarHint}</p> : null}
            {canChangeAvatar ? <p className="profile-hero-card__tap-hint">Tap photo to update</p> : null}
          </div>
        </div>

        <aside className="hero-card-main__worth">
          <p className="hero-card-main__worth-label">Total Worth</p>
          <p className="hero-card-main__worth-value">${profileCardData.totalWorth}M</p>
          <p className="hero-card-main__ovr">OVR {profileCardData.overall}</p>
          <svg className="hero-card-main__sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2 28 L24 26 L42 16 L62 18 L80 9 L98 3" />
          </svg>
        </aside>
      </div>

      <div className="hero-card-main__stats">
        <article className="hero-card-main__stat hero-card-main__stat--archetype">
          <p className="hero-card-main__stat-label">Main Archetype</p>
          <p className="hero-card-main__stat-value">{profileCardData.archetype}</p>
          {profileCardData.archetypeDescription ? (
            <p className="hero-card-main__stat-detail">{profileCardData.archetypeDescription}</p>
          ) : null}
        </article>
        <article className="hero-card-main__stat">
          <p className="hero-card-main__stat-label">MVP Trophies</p>
          <p className="hero-card-main__stat-value">{profileCardData.mvpTrophies}</p>
        </article>
        <article className="hero-card-main__stat">
          <p className="hero-card-main__stat-label">Matches Played</p>
          <p className="hero-card-main__stat-value">{profileCardData.matchesPlayed}</p>
        </article>
      </div>
    </section>
  )
}

function ProfilePlayerLayout({ player, backTo, identityExtra, afterRadar, accountDetails, radarData = [], profileCardData = null }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [copyHint, setCopyHint] = useState('')
  const isSelf = Boolean(accountDetails && player.id === accountDetails.playerId)
  const isOwnProfileTab = !backTo && profileCardData

  const copyEmail = async () => {
    if (!accountDetails?.email) return
    try {
      await navigator.clipboard.writeText(accountDetails.email)
      setCopyHint('Email copied')
    } catch {
      setCopyHint(accountDetails.email)
    }
    setTimeout(() => setCopyHint(''), 2200)
  }

  return (
    <div className="screen profile-screen">
      {backTo ? (
        <header className="player-profile-top">
          <Link to={backTo} className="player-profile-back" aria-label="Back">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M15 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <p className="player-profile-top__title">{player.name}</p>
        </header>
      ) : (
        <header className="profile-page-brand">
          <div className="profile-page-brand__texture" aria-hidden="true" />
          <h1 className="profile-page-brand__title">
            Your <span className="profile-page-brand__accent">Profile</span>
          </h1>
          <p className="profile-page-brand__tagline">
            Track your worth. <span className="profile-page-brand__tagline-accent">Own your game.</span>
          </p>
        </header>
      )}

      {profileCardData ? (
        <ProfileHeroCard profileCardData={profileCardData} player={player} />
      ) : (
        <section className="card home-profile-card profile-hero-card profile-hero-card--compact">
          <div className="profile-hero-card__compact-row">
            <div className="avatar avatar-xl hero-card-main__avatar home-profile-card__avatar">{player.initials}</div>
            <div className="profile-hero-card__compact-text">
              <h1 className="hero-name home-profile-card__name">{player.name}</h1>
              <p className="profile-hero-card__compact-worth">${player.value.toFixed(1)}M</p>
              <p className="profile-hero-card__compact-ovr">OVR {player.overall ?? Math.round(player.rating * 10)}</p>
            </div>
          </div>
          {identityExtra}
        </section>
      )}

      {profileCardData && identityExtra ? <div className="profile-logout-row">{identityExtra}</div> : null}

      <div className="profile-tabs-panel card">
        <Tabs tabs={profileTabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'overview' ? (
        <>
          <ProfileSectionHead
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 20h16M8 16V8M12 16V5M16 16v-3" strokeLinecap="round" />
              </svg>
            }
          >
            Performance
          </ProfileSectionHead>
          <div className="profile-stats-grid">
            <StatMini label="Games" value={player.games} />
            <StatMini label="Goals" value={player.goals} />
            <StatMini label="Assists" value={player.assists} />
            <StatMini label="MVPs" value={player.mvps} />
            <StatMini label="Win Rate" value={`${player.winRate}%`} />
            <StatMini label="Rating" value={player.rating.toFixed(1)} />
          </div>

          <ProfileSectionHead
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3 4 7v4c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V7l-8-4Z" />
              </svg>
            }
          >
            Player Style
          </ProfileSectionHead>
          <PlayerRadarChart data={radarData} />
          {afterRadar}
        </>
      ) : null}

      {activeTab === 'stats' ? (
        <>
          <ProfileSectionHead
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="5" width="16" height="14" rx="2.5" />
                <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" strokeLinecap="round" />
              </svg>
            }
          >
            Season Snapshot
          </ProfileSectionHead>
          <section className="card profile-panel-card player-profile-stats-extended">
            <div className="profile-detail-list profile-detail-list--premium">
              <div className="profile-detail-row">
                <span className="profile-detail-label">Games played</span>
                <span className="profile-detail-value">{player.games}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Goals</span>
                <span className="profile-detail-value">{player.goals}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Assists</span>
                <span className="profile-detail-value">{player.assists}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Saves</span>
                <span className="profile-detail-value">{player.saves}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">MVPs</span>
                <span className="profile-detail-value">{player.mvps}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Win rate</span>
                <span className="profile-detail-value">{player.winRate}%</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Rating</span>
                <span className="profile-detail-value">{player.rating.toFixed(1)}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Market value</span>
                <span className="profile-detail-value profile-detail-value--accent">${player.value.toFixed(1)}M</span>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'account' ? (
        <>
          <ProfileSectionHead
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="3" />
                <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
              </svg>
            }
          >
            Account
          </ProfileSectionHead>
          <section className="card profile-panel-card player-profile-account">
            {isSelf && accountDetails ? (
              <>
                <p className="meta profile-credentials-intro">
                  Sign-in details are mock data only. Password is never stored or shown in the app.
                </p>
                <div className="profile-detail-list profile-detail-list--premium">
                  <div className="profile-email-group">
                    <div className="profile-detail-row">
                      <span className="profile-detail-label">Email</span>
                      <span className="profile-detail-value is-mono">{accountDetails.email}</span>
                    </div>
                    <button type="button" className="profile-copy-email" onClick={copyEmail}>
                      Copy email
                    </button>
                    {copyHint ? <p className="meta toast-hint">{copyHint}</p> : null}
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Display Name</span>
                    <div className="profile-detail-value-wrap">
                      <span className="profile-detail-value">{accountDetails.displayName}</span>
                      <span className="profile-detail-hint">Shown across the app</span>
                    </div>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Username</span>
                    <div className="profile-detail-value-wrap">
                      <span className="profile-detail-value is-mono">{accountDetails.username}</span>
                      <span className="profile-detail-hint">Used to sign in</span>
                    </div>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Phone</span>
                    <span className="profile-detail-value">{accountDetails.phone}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Password</span>
                    <div className="profile-detail-value-wrap">
                      <span className="profile-detail-value is-mono">••••••••</span>
                      <span className="profile-detail-hint">
                        Hidden for your security — connect a real account later to change it.
                      </span>
                    </div>
                  </div>
                </div>
                <p className="meta profile-footnote profile-footnote--account">
                  Account stats and profile card values are loaded from the backend profile data.
                </p>
              </>
            ) : (
              <>
                <p className="meta">
                  Account and sign-in details are only available on your own profile. Open Profile in the tab bar to
                  manage leagues and credentials.
                </p>
                <Link to="/profile">
                  <PrimaryButton className="w-full profile-account-cta">Go to Profile</PrimaryButton>
                </Link>
              </>
            )}
          </section>
        </>
      ) : null}

      {isOwnProfileTab ? (
        <section className="card home-footer-card profile-footer-card" aria-label="Motivation">
          <span className="home-footer-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 3 4 7v4c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V7l-8-4Z" />
            </svg>
          </span>
          <p className="home-footer-card__text">
            Show up every week. <span className="home-footer-card__accent">Your stats tell the story.</span>
          </p>
        </section>
      ) : null}
    </div>
  )
}

export default ProfilePlayerLayout
