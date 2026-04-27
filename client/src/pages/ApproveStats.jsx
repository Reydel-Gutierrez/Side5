import { Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import StatusChip from '../components/StatusChip'
import { useMockApp } from '../context/MockAppContext'

function ApproveStats() {
  const { matchId } = useParams()
  const { statSubmissions, players, reviewSubmission, canApproveStatsForMatch } = useMockApp()

  if (!canApproveStatsForMatch(matchId)) {
    return <Navigate to={`/matches/${matchId}`} replace />
  }

  const submission = statSubmissions.find((item) => item.matchId === matchId && item.status === 'pending')
  if (!submission) return <Navigate to="/stats" replace />

  const player = players.find((item) => item.id === submission.playerId)

  return (
    <div className="screen">
      <PageHeader title="Approve Stats" />
      <StatusChip tone="orange">Pending review</StatusChip>

      <section className="card">
        <p className="session-title">{player?.name}</p>
        <p className="meta">Submitted May 27 · 10:15 PM</p>
        <div className="info-grid">
          <div>
            <p className="meta">Goals</p>
            <p>{submission.goals}</p>
          </div>
          <div>
            <p className="meta">Assists</p>
            <p>{submission.assists}</p>
          </div>
          <div>
            <p className="meta">Saves</p>
            <p>{submission.saves}</p>
          </div>
          <div>
            <p className="meta">MVP</p>
            <p>{submission.mvp ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <p className="meta">Notes: {submission.notes || '-'}</p>
      </section>

      <div className="button-row">
        <SecondaryButton
          onClick={() => {
            const r = reviewSubmission(submission.id, 'denied')
            if (!r.ok) window.alert(r.reason)
          }}
        >
          Deny
        </SecondaryButton>
        <PrimaryButton
          onClick={() => {
            const r = reviewSubmission(submission.id, 'approved')
            if (!r.ok) window.alert(r.reason)
          }}
        >
          Approve
        </PrimaryButton>
      </div>

      <p className="meta">
        Stats require approval from a league manager or a team captain for this session. Approved stats count toward the
        league leaderboard; denied stats do not.
      </p>
    </div>
  )
}

export default ApproveStats
