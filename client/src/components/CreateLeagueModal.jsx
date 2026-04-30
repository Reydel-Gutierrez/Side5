import { useEffect, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'

const defaultForm = {
  name: '',
  description: '',
  defaultFormat: '5v5',
}

function CreateLeagueModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ ...defaultForm })
      setError('')
    }
  }, [open])

  if (!open) return null

  const save = () => {
    if (!form.name.trim()) {
      setError('Enter a league name.')
      return
    }
    onCreate({
      name: form.name.trim(),
      description: form.description.trim(),
      defaultFormat: form.defaultFormat,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-league-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="create-league-title" className="page-title">
            Create League
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="meta">Leagues group sessions and stats for your group.</p>

        <div className="form-stack">
          <label className="field">
            <span className="field-label">League name</span>
            <input
              className="field-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Monday Ballers"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea
              className="text-area"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Weekly pickup group for Monday nights."
            />
          </label>
          <label className="field">
            <span className="field-label">Default format</span>
            <select
              className="field-input"
              value={form.defaultFormat}
              onChange={(e) => setForm((f) => ({ ...f, defaultFormat: e.target.value }))}
            >
              <option value="5v5">5v5</option>
              <option value="6v6">6v6</option>
              <option value="7v7">7v7</option>
            </select>
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="button-row modal-actions">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" onClick={save}>
            Create
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export default CreateLeagueModal
