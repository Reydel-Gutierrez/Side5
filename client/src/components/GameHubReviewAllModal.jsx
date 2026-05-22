import { useEffect, useMemo, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import StatusChip from './StatusChip'

function playerName(row) {
  return row?.display_name || row?.username || 'Player'
}

function submissionStatusTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved') return 'confirmed'
  if (s === 'declined') return 'orange'
  return 'invited'
}

function submissionStatusLabel(row) {
  if (!row?.submission) return 'No submission'
  const s = String(row.submission.status || '').toLowerCase()
  if (s === 'approved') return 'Approved'
  if (s === 'declined') return 'Declined'
  if (s === 'pending') return 'Pending review'
  return s
}

function reviewSummary(review) {
  if (!review) return '—'
  if (review.decision === 'accepted') {
    return `Accepted · ${review.rating_label || '—'} (${review.rating_value ?? '—'})`
  }
  if (review.decision === 'declined') {
    return `Declined${review.decline_note ? `: ${review.decline_note}` : ''}`
  }
  return 'Pending'
}

function defaultInclude(row) {
  if (!row?.submission) return false
  return row.submission.status === 'approved' || row.submission.status === 'pending'
}

function buildDraftFromRow(row) {
  const sub = row.submission
  const rating =
    sub?.approved_rating ?? row.calculated_rating ?? ''
  return {
    goals: sub?.goals ?? 0,
    result: sub?.result === 'loss' ? 'loss' : 'win',
    approved_rating: rating === '' ? '' : String(rating),
    rating_label: '',
    include: defaultInclude(row),
  }
}

function ratingValueFromLabel(label, ratingOptions) {
  const opt = ratingOptions.find((o) => o.label === label)
  return opt?.value ?? ''
}

export default function GameHubReviewAllModal({
  open,
  busy,
  reviewAll,
  statsFinalized,
  ratingOptions = [],
  onClose,
  onSave,
  onFinalize,
  onRefresh,
}) {
  const [drafts, setDrafts] = useState({})
  const [mvpWinnerId, setMvpWinnerId] = useState('')

  const players = useMemo(() => (Array.isArray(reviewAll?.players) ? reviewAll.players : []), [reviewAll])
  const mvpTotals = useMemo(() => (Array.isArray(reviewAll?.mvp_totals) ? reviewAll.mvp_totals : []), [reviewAll])
  const needsMvpPick = Boolean(reviewAll?.mvp_needs_pick) && !statsFinalized
  const tiedIds = useMemo(
    () => new Set((reviewAll?.mvp_tied_user_ids || []).map((id) => String(id))),
    [reviewAll],
  )

  useEffect(() => {
    if (!open) return
    const next = {}
    for (const row of players) {
      next[String(row.user_id)] = buildDraftFromRow(row)
    }
    setDrafts(next)
    if (reviewAll?.mvp_winner_user_id) {
      setMvpWinnerId(String(reviewAll.mvp_winner_user_id))
    } else if (needsMvpPick && mvpTotals.length) {
      setMvpWinnerId(String(mvpTotals[0].user_id))
    } else {
      setMvpWinnerId('')
    }
  }, [open, players, reviewAll, needsMvpPick, mvpTotals])

  const includedCount = useMemo(
    () => players.filter((row) => drafts[String(row.user_id)]?.include).length,
    [players, drafts],
  )

  const pendingCount = useMemo(
    () =>
      players.filter(
        (row) =>
          row.awaiting_player ||
          row.awaiting_reviewers ||
          (row.submission && row.submission.status !== 'approved'),
      ).length,
    [players],
  )

  if (!open) return null

  const updateDraft = (userId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [String(userId)]: { ...prev[String(userId)], ...patch },
    }))
  }

  const handleRatingLabelChange = (userId, label) => {
    const value = ratingValueFromLabel(label, ratingOptions)
    updateDraft(userId, {
      rating_label: label,
      approved_rating: value !== '' ? String(value) : '',
    })
  }

  const buildPlayersPayload = (onlyIncluded) => {
    return players
      .map((row) => {
        const draft = drafts[String(row.user_id)]
        if (!draft) return null
        if (onlyIncluded && !draft.include) return null
        const rating = Number(draft.approved_rating)
        if (onlyIncluded && (draft.approved_rating === '' || Number.isNaN(rating))) {
          return null
        }
        return {
          user_id: row.user_id,
          submission_id: row.submission?.id,
          goals: Math.max(0, Number.parseInt(String(draft.goals), 10) || 0),
          result: draft.result === 'loss' ? 'loss' : 'win',
          approved_rating: draft.approved_rating === '' ? undefined : rating,
          include: draft.include,
        }
      })
      .filter(Boolean)
  }

  const handleSave = async () => {
    const payload = buildPlayersPayload(false).filter(
      (p) => p.approved_rating != null && !Number.isNaN(p.approved_rating),
    )
    if (!payload.length) return
    await onSave?.({ players: payload })
    await onRefresh?.()
  }

  const handleFinalize = () => {
    const missingRating = players.filter((row) => {
      const draft = drafts[String(row.user_id)]
      return draft?.include && (draft.approved_rating === '' || Number.isNaN(Number(draft.approved_rating)))
    })
    if (missingRating.length > 0) {
      window.alert('Each included player needs a match rating before you push final results.')
      return
    }

    const payload = buildPlayersPayload(true)
    if (!payload.length) {
      const closeOnly = window.confirm(
        'No players selected to add to league stats. Close the session without updating anyone?',
      )
      if (!closeOnly) return
    }
    onFinalize?.({
      players: payload,
      mvp_winner_user_id: needsMvpPick && mvpWinnerId ? Number(mvpWinnerId) : undefined,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card game-hub-review-all-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-hub-review-all-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-hub-review-all-modal__scroll">
          <div className="modal-header">
            <h2 id="game-hub-review-all-title" className="page-title">
              Review All
            </h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <p className="meta game-hub-review-all-modal__intro">
            {statsFinalized
              ? 'Stats are finalized for this session.'
              : `Enter or override stats for any player. ${includedCount} adding to league stats${pendingCount > 0 ? ` · ${pendingCount} still incomplete` : ''}. You can close the session even if others have not submitted.`}
          </p>

          {needsMvpPick ? (
            <div className="field game-hub-mvp-pick">
              <label className="field-label" htmlFor="game-hub-mvp-winner">
                MVP tie-breaker
              </label>
              <select
                id="game-hub-mvp-winner"
                className="field-input"
                value={mvpWinnerId}
                disabled={statsFinalized || busy}
                onChange={(e) => setMvpWinnerId(e.target.value)}
              >
                {mvpTotals
                  .filter((t) => tiedIds.has(String(t.user_id)))
                  .map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {playerName(t)} ({t.vote_count} votes)
                    </option>
                  ))}
              </select>
            </div>
          ) : null}

          <ul className="game-hub-review-all-list">
          {players.map((row) => {
            const sub = row.submission
            const reviews = Array.isArray(row.reviews) ? row.reviews : []
            const draft = drafts[String(row.user_id)] || buildDraftFromRow(row)
            const ratingLabel =
              draft.rating_label ||
              ratingOptions.find((o) => String(o.value) === String(draft.approved_rating))?.label ||
              ''

            return (
              <li key={row.user_id} className="game-hub-review-all-row">
                <div className="game-hub-review-all-row__head">
                  <strong>{playerName(row)}</strong>
                  <StatusChip tone={submissionStatusTone(sub?.status)}>
                    {submissionStatusLabel(row)}
                  </StatusChip>
                </div>

                {row.awaiting_player ? (
                  <p className="meta game-hub-review-all-hint">Player did not submit — enter stats below.</p>
                ) : null}
                {row.awaiting_reviewers ? (
                  <p className="meta game-hub-review-all-hint">
                    Waiting on teammate reviews — set a match rating to manager-approve.
                  </p>
                ) : null}

                <div className="game-hub-review-all-row__grid">
                  <label className="game-hub-review-all-check">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.include)}
                      disabled={statsFinalized || busy}
                      onChange={(e) => updateDraft(row.user_id, { include: e.target.checked })}
                    />
                    <span>Add to league stats</span>
                  </label>

                  <label className="game-hub-review-all-field">
                    <span>Goals</span>
                    <input
                      type="number"
                      min={0}
                      className="field-input"
                      disabled={statsFinalized || busy}
                      value={draft.goals}
                      onChange={(e) => updateDraft(row.user_id, { goals: e.target.value })}
                    />
                  </label>
                  <label className="game-hub-review-all-field">
                    <span>Result</span>
                    <select
                      className="field-input"
                      disabled={statsFinalized || busy}
                      value={draft.result}
                      onChange={(e) => updateDraft(row.user_id, { result: e.target.value })}
                    >
                      <option value="win">Win</option>
                      <option value="loss">Loss</option>
                    </select>
                  </label>
                  <label className="game-hub-review-all-field">
                    <span>Match rating</span>
                    {ratingOptions.length > 0 ? (
                      <select
                        className="field-input"
                        disabled={statsFinalized || busy}
                        value={ratingLabel}
                        onChange={(e) => handleRatingLabelChange(row.user_id, e.target.value)}
                      >
                        <option value="">Select rating…</option>
                        {ratingOptions.map((opt) => (
                          <option key={opt.label} value={opt.label}>
                            {opt.label} ({opt.value})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={10}
                        className="field-input"
                        disabled={statsFinalized || busy}
                        value={draft.approved_rating}
                        onChange={(e) =>
                          updateDraft(row.user_id, { approved_rating: e.target.value })
                        }
                      />
                    )}
                  </label>

                  {sub ? (
                    <>
                      <p className="meta game-hub-review-all-meta">
                        Reviewer 1: {reviewSummary(reviews[0])}
                      </p>
                      <p className="meta game-hub-review-all-meta">
                        Reviewer 2: {reviewSummary(reviews[1])}
                      </p>
                    </>
                  ) : null}
                  <p className="meta game-hub-review-all-meta">
                    Avg from reviews: {row.calculated_rating ?? '—'} · MVP votes: {row.mvp_votes ?? 0}
                  </p>
                </div>
              </li>
            )
          })}
          </ul>
        </div>

        <div className="game-hub-review-all-modal__footer modal-actions">
          {!statsFinalized ? (
            <>
              <SecondaryButton type="button" className="w-full" disabled={busy} onClick={handleSave}>
                Save without closing
              </SecondaryButton>
              <PrimaryButton type="button" className="w-full" disabled={busy} onClick={handleFinalize}>
                Push final results & close session
              </PrimaryButton>
            </>
          ) : null}
          <SecondaryButton type="button" className="w-full" disabled={busy} onClick={onClose}>
            Close
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
