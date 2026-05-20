import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import GameHubReviewModal from '../components/GameHubReviewModal'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import StatusChip from '../components/StatusChip'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'

function displayName(row) {
  return row?.display_name || row?.username || 'Player'
}

function targetLabel(assignment) {
  return assignment?.target_display_name || assignment?.target_username || 'Player'
}

function submissionStatusTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved') return 'confirmed'
  if (s === 'declined') return 'orange'
  return 'invited'
}

function submissionStatusLabel(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved') return 'Approved'
  if (s === 'declined') return 'Declined'
  if (s === 'pending') return 'Pending review'
  return s || '—'
}

function reviewButtonLabel(assignment) {
  const name = targetLabel(assignment)
  if (assignment.can_review) return `Review ${name}`
  if (String(assignment.review_decision || '') === 'accepted') return `Reviewed ${name} ✓`
  if (String(assignment.review_decision || '') === 'declined') return `Declined ${name}`
  return `Review ${name}`
}

function GameHub() {
  const { sessionId } = useParams()
  const { currentUserId } = useMockApp()
  const numericSessionId = Number.parseInt(String(sessionId), 10)
  const actorId = Number.parseInt(String(currentUserId ?? ''), 10)

  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [activeReview, setActiveReview] = useState(null)

  const [goals, setGoals] = useState(0)
  const [result, setResult] = useState('win')
  const [note, setNote] = useState('')

  const loadHub = useCallback(async () => {
    if (Number.isNaN(numericSessionId)) return
    const qs = Number.isNaN(actorId) ? '' : `?userId=${actorId}`
    const res = await apiFetch(`/api/sessions/${numericSessionId}/game-hub${qs}`, { cache: 'no-store' })
    const data = res?.data || null
    setHub(data)
    if (data?.mySubmission) {
      setGoals(Number(data.mySubmission.goals) || 0)
      setResult(data.mySubmission.result === 'loss' ? 'loss' : 'win')
      setNote(data.mySubmission.note || '')
    }
    if (data?.teams?.length) {
      setActiveTeamId((prev) => prev || String(data.teams[0].id))
    }
  }, [numericSessionId, actorId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (Number.isNaN(numericSessionId)) return
      setLoading(true)
      setError('')
      try {
        await loadHub()
      } catch (err) {
        if (mounted) setError(err?.message || 'Could not load Game Hub')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [numericSessionId, loadHub])

  useEffect(() => {
    const interval = setInterval(() => {
      loadHub().catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [loadHub])

  const teams = hub?.teams ?? []
  const teamTabs = useMemo(
    () => teams.map((t) => ({ id: String(t.id), label: t.name || 'Team' })),
    [teams],
  )
  const activeTeam = teams.find((t) => String(t.id) === String(activeTeamId)) ?? teams[0]

  const mySubmission = hub?.mySubmission
  const canEditSubmission =
    hub?.canSubmit &&
    (!mySubmission || mySubmission.status === 'declined')
  const showSubmitForm = canEditSubmission

  const reviewAssignments = Array.isArray(hub?.reviewAssignments) ? hub.reviewAssignments : []

  const handleSubmitStats = async () => {
    if (Number.isNaN(actorId)) return
    setBusy(true)
    setError('')
    try {
      await apiFetch(`/api/sessions/${numericSessionId}/stat-submissions`, {
        method: 'POST',
        body: JSON.stringify({
          userId: actorId,
          goals: Math.max(0, Number.parseInt(String(goals), 10) || 0),
          result,
          note: note.trim() || undefined,
        }),
      })
      await loadHub()
    } catch (err) {
      setError(err?.message || 'Could not submit stats')
    } finally {
      setBusy(false)
    }
  }

  const handleReview = async (assignment, decision, declineNote) => {
    if (Number.isNaN(actorId) || !assignment?.submission_id) return
    setBusy(true)
    setError('')
    try {
      await apiFetch(`/api/stat-submissions/${assignment.submission_id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          reviewerUserId: actorId,
          decision,
          decline_note: decision === 'declined' ? declineNote : undefined,
        }),
      })
      setActiveReview(null)
      await loadHub()
    } catch (err) {
      setError(err?.message || 'Could not submit review')
    } finally {
      setBusy(false)
    }
  }

  const openReviewModal = (assignment) => {
    if (!assignment?.can_review) return
    setActiveReview(assignment)
  }

  if (Number.isNaN(numericSessionId)) {
    return <Navigate to="/sessions" replace />
  }

  if (loading) {
    return (
      <div className="screen">
        <PageHeader title="Game Hub" subtitle="Loading…" />
        <section className="card">
          <p className="meta">Loading session…</p>
        </section>
      </div>
    )
  }

  if (!hub?.session) {
    return (
      <div className="screen">
        <PageHeader title="Game Hub" />
        <section className="card">
          <p className="meta">{error || 'Session not found.'}</p>
          <Link to="/sessions">
            <PrimaryButton className="w-full">Back to sessions</PrimaryButton>
          </Link>
        </section>
      </div>
    )
  }

  if (!hub.allTeamsLocked) {
    return (
      <div className="screen">
        <PageHeader title="Game Hub" subtitle={hub.session.title} />
        <section className="card center-card">
          <p className="meta">All teams must be locked before Game Hub opens.</p>
          <Link to={`/draft/${hub.session.id}`}>
            <PrimaryButton className="w-full">Back to draft</PrimaryButton>
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="screen game-hub-page">
      <PageHeader
        title="Game Hub"
        subtitle={hub.session.title}
        rightContent={
          hub.league?.name ? (
            <span className="meta">{hub.league.name}</span>
          ) : null
        }
      />

      <section className="card center-card">
        <div className="lock-icon" aria-hidden="true">
          🔒
        </div>
        <p>Teams are locked. Submit your stats and help verify everyone else&apos;s.</p>
      </section>

      {teamTabs.length > 0 ? (
        <Tabs tabs={teamTabs} activeTab={String(activeTeam?.id || teamTabs[0].id)} onChange={setActiveTeamId} />
      ) : null}

      {activeTeam ? (
        <section className="card">
          <p className="session-title">{activeTeam.name}</p>
          <ul className="list-plain">
            {(activeTeam.players || []).map((player) => (
              <li key={`${activeTeam.id}-${player.user_id}`} className="list-row">
                <span>
                  {displayName(player)}
                  {player.is_captain ? ' · Captain' : ''}
                </span>
                <span className="meta">${Number(player.player_worth || 0).toFixed(1)}M</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reviewAssignments.length > 0 ? (
        <section className="card">
          <h2 className="session-title">Review teammates</h2>
          <p className="meta">
            Review buttons unlock once each player submits their stats.
          </p>
          <ul className="list-plain game-hub-review-slots">
            {reviewAssignments.map((assignment) => {
              const waiting = !assignment.target_has_submitted
              const done = String(assignment.review_decision || 'pending') !== 'pending'
              return (
                <li key={assignment.slot_id} className="game-hub-review-slot">
                  <PrimaryButton
                    type="button"
                    className={`w-full game-hub-review-btn${assignment.can_review ? '' : ' is-disabled'}`}
                    disabled={busy || !assignment.can_review}
                    onClick={() => openReviewModal(assignment)}
                  >
                    {reviewButtonLabel(assignment)}
                  </PrimaryButton>
                  {waiting ? (
                    <p className="meta game-hub-review-slot__hint">
                      Waiting for {targetLabel(assignment)} to submit stats
                    </p>
                  ) : null}
                  {done && !assignment.can_review ? (
                    <p className="meta">Your review is recorded.</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <h2 className="session-title">Submit My Stats</h2>
        {!hub.canSubmit ? (
          <p className="meta">You need to be on a team in this session to submit stats.</p>
        ) : null}

        {mySubmission ? (
          <p className="meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Status:{' '}
            <StatusChip tone={submissionStatusTone(mySubmission.status)}>
              {submissionStatusLabel(mySubmission.status)}
            </StatusChip>
          </p>
        ) : null}

        {mySubmission?.status === 'declined' && mySubmission.decline_note ? (
          <p className="meta game-hub-decline-note">
            Declined: {mySubmission.decline_note}
          </p>
        ) : null}

        {mySubmission?.status === 'approved' ? (
          <p className="meta">
            Your stats were approved — {mySubmission.goals} goal{mySubmission.goals === 1 ? '' : 's'},{' '}
            {mySubmission.result === 'win' ? 'win' : 'loss'}.
          </p>
        ) : null}

        {mySubmission?.status === 'pending' ? (
          <p className="meta">Waiting for two teammates to confirm your submission.</p>
        ) : null}

        {showSubmitForm ? (
          <>
            <div className="field">
              <label className="field-label" htmlFor="game-hub-goals">
                Goals
              </label>
              <input
                id="game-hub-goals"
                className="field-input"
                type="number"
                min={0}
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="field">
              <span className="field-label">Result</span>
              <div className="button-row game-hub-result-row">
                <SecondaryButton
                  type="button"
                  className={result === 'win' ? 'game-hub-result-btn is-active' : 'game-hub-result-btn'}
                  disabled={busy}
                  onClick={() => setResult('win')}
                >
                  Win
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  className={result === 'loss' ? 'game-hub-result-btn is-active' : 'game-hub-result-btn'}
                  disabled={busy}
                  onClick={() => setResult('loss')}
                >
                  Loss
                </SecondaryButton>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="game-hub-note">
                Note (optional)
              </label>
              <textarea
                id="game-hub-note"
                className="field-input"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
                placeholder="Quick note for reviewers"
              />
            </div>
            <PrimaryButton type="button" className="w-full" disabled={busy || !hub.canSubmit} onClick={handleSubmitStats}>
              {mySubmission?.status === 'declined' ? 'Resubmit stats' : 'Submit stats'}
            </PrimaryButton>
          </>
        ) : null}
      </section>

      {error ? <p className="meta game-hub-error">{error}</p> : null}

      <div className="button-row">
        <Link to={`/draft/${hub.session.id}`}>
          <SecondaryButton>Back to draft</SecondaryButton>
        </Link>
        <Link to={`/sessions/${hub.session.id}`}>
          <SecondaryButton>Session</SecondaryButton>
        </Link>
      </div>

      <GameHubReviewModal
        key={activeReview?.review_id || 'closed'}
        open={Boolean(activeReview)}
        assignment={activeReview}
        busy={busy}
        onClose={() => setActiveReview(null)}
        onSubmitReview={handleReview}
      />
    </div>
  )
}

export default GameHub
