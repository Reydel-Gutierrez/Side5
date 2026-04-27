import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlayerRadarChart from './PlayerRadarChart'
import Tabs from './Tabs'

const profileTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'account', label: 'Account' },
]

function StatMini({ label, value }) {
  return (
    <article className="card mini-card player-stat-mini">
      <p className="meta player-stat-mini-label">{label}</p>
      <p className="player-stat-mini-value">{value}</p>
    </article>
  )
}

function ProfilePlayerLayout({ player, backTo, identityExtra, afterRadar, accountDetails }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [copyHint, setCopyHint] = useState('')
  const isSelf = Boolean(accountDetails && player.id === accountDetails.playerId)

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
    <div className="screen">
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
        </header>
      ) : (
        <header className="player-profile-top player-profile-top--spacer" aria-hidden="true" />
      )}

      <section className="card player-profile-identity">
        <div className="player-profile-identity-row">
          <div className="avatar avatar-xl player-profile-avatar">{player.initials}</div>
          <div className="player-profile-identity-text">
            <h1 className="player-profile-name">{player.name}</h1>
            <p className="player-profile-value">${player.value.toFixed(1)}M</p>
            <p className="meta player-profile-position">{player.position}</p>
            {identityExtra}
          </div>
        </div>
      </section>

      <Tabs tabs={profileTabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <>
          <div className="stats-cards-grid">
            <StatMini label="Games" value={player.games} />
            <StatMini label="Goals" value={player.goals} />
            <StatMini label="Assists" value={player.assists} />
            <StatMini label="MVPs" value={player.mvps} />
            <StatMini label="Win Rate" value={`${player.winRate}%`} />
            <StatMini label="Rating" value={player.rating.toFixed(1)} />
          </div>
          <PlayerRadarChart player={player} />
          {afterRadar}
        </>
      ) : null}

      {activeTab === 'stats' ? (
        <section className="card player-profile-stats-extended">
          <p className="session-title">Season snapshot</p>
          <div className="profile-detail-list">
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
              <span className="profile-detail-value">${player.value.toFixed(1)}M</span>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'account' ? (
        <section className="card player-profile-account">
          {isSelf && accountDetails ? (
            <>
              <p className="meta player-credentials-intro">
                Sign-in details are mock data only. Password is never stored or shown in the app.
              </p>
              <div className="profile-detail-list">
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
                Database and authentication are not wired up yet; this screen previews the experience.
              </p>
            </>
          ) : (
            <>
              <p className="meta">
                Account and sign-in details are only available on your own profile. Open Profile in the tab bar to
                manage leagues and credentials.
              </p>
              <Link to="/profile" className="player-profile-account-link">
                Go to Profile
              </Link>
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}

export default ProfilePlayerLayout
