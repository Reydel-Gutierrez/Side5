import { Link } from 'react-router-dom'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import StatusChip from './StatusChip'
import { sessionStatusTone } from '../utils/sessionStatus'
import { sessionRosterIds } from '../utils/sessionRoster'

function SessionCard({ session, showLeague }) {
  const roster = sessionRosterIds(session)
  const tone = sessionStatusTone(session.status)
  const statusLabel = session.status.replace(/_/g, ' ')

  return (
    <article className="card session-card">
      <p className="session-title">{session.title}</p>
      {showLeague && session.leagueName ? (
        <p className="meta league-inline">League: {session.leagueName}</p>
      ) : null}
      <p className="meta">
        {session.date} · {session.time}
      </p>
      <p className="meta">
        {roster.length} / {session.maxPlayers ?? 10} Players
      </p>
      <StatusChip tone={tone}>{statusLabel}</StatusChip>
      <div className="button-row">
        <Link to={`/sessions/${session.id}`}>
          <SecondaryButton className="w-full">Details</SecondaryButton>
        </Link>
        <Link to={`/sessions/${session.id}`}>
          <PrimaryButton className="w-full">Join</PrimaryButton>
        </Link>
      </div>
    </article>
  )
}

export default SessionCard
