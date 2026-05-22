import { Link } from 'react-router-dom'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import StatusChip from './StatusChip'
import { sessionStatusTone } from '../utils/sessionStatus'
import { sessionRosterIds } from '../utils/sessionRoster'

function SessionCard({ session, showLeague, variant = 'default' }) {
  const roster = sessionRosterIds(session)
  const tone = sessionStatusTone(session.status)
  const statusLabel = session.status.replace(/_/g, ' ')

  if (variant === 'dashboard') {
    return (
      <article className="card session-card home-session-card">
        <div className="home-dashboard-card__body">
          <div className="home-dashboard-card__icon home-dashboard-card__icon--pitch" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <path d="M12 5v14M4 12h16" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.2" />
            </svg>
          </div>
          <div className="home-dashboard-card__content">
            <div className="home-session-card__title-row">
              <p className="home-dashboard-card__title">{session.title}</p>
              <StatusChip tone={tone} className="home-session-card__status">
                {statusLabel}
              </StatusChip>
            </div>
            {showLeague && session.leagueName ? (
              <p className="home-dashboard-card__meta">League: {session.leagueName}</p>
            ) : null}
            <p className="home-dashboard-card__meta">
              <span className="home-session-card__meta-item">{session.date}</span>
              <span className="home-session-card__meta-sep" aria-hidden="true">
                ·
              </span>
              <span className="home-session-card__meta-item">{session.time}</span>
            </p>
            <p className="home-dashboard-card__meta home-dashboard-card__meta--accent">
              {roster.length} / {session.maxPlayers ?? 10} players going
            </p>
          </div>
        </div>
        <div className="button-row home-card-actions">
          <Link to={`/sessions/${session.id}`} className="w-full">
            <SecondaryButton className="w-full home-btn-secondary">Details</SecondaryButton>
          </Link>
          <Link to={`/sessions/${session.id}`} className="w-full">
            <PrimaryButton className="w-full home-btn-primary">Open</PrimaryButton>
          </Link>
        </div>
      </article>
    )
  }

  return (
    <article className="card session-card">
      <p className="session-title">{session.title}</p>
      {showLeague && session.leagueName ? (
        <p className="meta league-inline">League: {session.leagueName}</p>
      ) : null}
      <p className="meta">
        {session.date} · {session.time}
      </p>
      {session.league_id ? <p className="meta">League ID: {session.league_id}</p> : null}
      <p className="meta">
        {roster.length} / {session.maxPlayers ?? 10} Players
      </p>
      <StatusChip tone={tone}>{statusLabel}</StatusChip>
      <div className="button-row">
        <Link to={`/sessions/${session.id}`}>
          <SecondaryButton className="w-full">Details</SecondaryButton>
        </Link>
        <Link to={`/sessions/${session.id}`}>
          <PrimaryButton className="w-full">Open</PrimaryButton>
        </Link>
      </div>
    </article>
  )
}

export default SessionCard
