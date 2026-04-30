import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import StatusChip from '../components/StatusChip'
import { useMockApp } from '../context/MockAppContext'

function CaptainReview() {
  const { matchId } = useParams()
  const { canApproveStatsForMatch, statSubmissions, players, reviewSubmission } = useMockApp()
  const [denyFormById, setDenyFormById] = useState({})
  const [error, setError] = useState('')

  if (!canApproveStatsForMatch(matchId)) {
    return <Navigate to={`/matches/${matchId}`} replace />
  }

  const pendingSubmissions = useMemo(
    () => statSubmissions.filter((item) => item.matchId === matchId && item.status === 'pending'),
    [statSubmissions, matchId],
  )

  const playerName = (playerId) => players.find((item) => item.id === playerId)?.name ?? 'Player'

  const handleApprove = (submissionId) => {
    setError('')
    const response = reviewSubmission(submissionId, 'approved')
    if (!response.ok) setError(response.reason)
  }

  const handleDeny = (submissionId) => {
    setError('')
    const comment = String(denyFormById[submissionId] ?? '').trim()
    const response = reviewSubmission(submissionId, 'denied', comment)
    if (!response.ok) {
      setError(response.reason)
      return
    }
    setDenyFormById((prev) => ({ ...prev, [submissionId]: '' }))
  }

  return (
    <div className="screen">
      <PageHeader title="Captain Review" />

      {pendingSubmissions.length === 0 ? (
        <section className="card">
          <p className="meta">No pending stat submissions for this match.</p>
        </section>
      ) : (
        <div className="screen-stack">
          {pendingSubmissions.map((submission) => (
            <section key={submission.id} className="card">
              <div className="post-match-review-header">
                <p className="session-title">{playerName(submission.playerId)}</p>
                <StatusChip tone="orange">pending</StatusChip>
              </div>
              <div className="info-grid">
                <div>
                  <p className="meta">Goals</p>
                  <p>{submission.goals}</p>
                </div>
                <div>
                  <p className="meta">Result</p>
                  <p style={{ textTransform: 'capitalize' }}>{submission.result}</p>
                </div>
              </div>

              <label className="text-area-label" htmlFor={`deny-${submission.id}`}>
                Denial comment (required if denying)
              </label>
              <textarea
                id={`deny-${submission.id}`}
                className="text-area"
                value={denyFormById[submission.id] ?? ''}
                placeholder="Explain what needs to be corrected."
                onChange={(event) => setDenyFormById((prev) => ({ ...prev, [submission.id]: event.target.value }))}
              />

              <div className="button-row">
                <SecondaryButton className="w-full" onClick={() => handleDeny(submission.id)}>
                  Deny
                </SecondaryButton>
                <PrimaryButton className="w-full" onClick={() => handleApprove(submission.id)}>
                  Approve
                </PrimaryButton>
              </div>
            </section>
          ))}
        </div>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}

export default CaptainReview
