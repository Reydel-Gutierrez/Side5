import { useEffect, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'

function DeleteSessionModal({ open, session, onClose, onConfirm }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setError('')
      setBusy(false)
    }
  }, [open, session?.id])

  if (!open || !session) return null

  const label = String(session.title || 'this session').trim() || 'this session'

  const handleConfirm = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await onConfirm(session)
      if (!result?.ok) {
        setError(result?.reason || 'Could not delete session.')
        setBusy(false)
        return
      }
      onClose()
    } catch (e) {
      setError(e?.message || 'Could not delete session.')
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className="modal-panel card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-session-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="delete-session-title" className="page-title">
            Delete session
          </h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">
            ×
          </button>
        </div>
        <p className="meta">
          Delete &quot;{label}&quot;? This removes the session and related teams or sign-ups. This cannot be undone.
        </p>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="button-row modal-actions">
          <SecondaryButton type="button" onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export default DeleteSessionModal
