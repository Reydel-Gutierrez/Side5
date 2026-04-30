import { useEffect, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'

function JoinLeagueModal({ open, onClose, onJoin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCode('')
      setError('')
    }
  }, [open])

  if (!open) return null

  const save = async () => {
    if (!code.trim()) {
      setError('Enter an invite code.')
      return
    }
    const result = await onJoin(code.trim())
    if (!result.ok) {
      setError(result.reason)
      return
    }
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-league-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="join-league-title" className="page-title">
            Join League
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="meta">Enter the invite code from your organizer.</p>

        <div className="form-stack">
          <label className="field">
            <span className="field-label">Invite code</span>
            <input
              className="field-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SIDE5-MON"
              autoComplete="off"
            />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="button-row modal-actions">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" onClick={save}>
            Join
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export default JoinLeagueModal
