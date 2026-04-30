import { useCallback, useEffect, useMemo, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import { apiFetch } from '../utils/apiFetch'

function memberLabel(row) {
  return row.display_name || row.username || `User ${row.user_id}`
}

export default function SessionCaptainModal({
  open,
  onClose,
  sessionId,
  leagueId,
  actingUserId,
  sessionTitle,
  onUpdated,
}) {
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState([])
  const [teams, setTeams] = useState([])
  const [draftByTeamId, setDraftByTeamId] = useState({})

  const actorNumeric = Number.parseInt(String(actingUserId ?? ''), 10)
  const sid = Number.parseInt(String(sessionId ?? ''), 10)
  const lid = Number.parseInt(String(leagueId ?? ''), 10)

  const loadData = useCallback(async () => {
    if (!open || Number.isNaN(sid) || Number.isNaN(lid)) return
    const [memRes, teamRes] = await Promise.all([
      apiFetch(`/api/leagues/${lid}/members`, { cache: 'no-store' }),
      apiFetch(`/api/sessions/${sid}/teams`, { cache: 'no-store' }),
    ])
    const memRows = Array.isArray(memRes?.data) ? memRes.data : []
    const teamRows = Array.isArray(teamRes?.data) ? teamRes.data : []
    setMembers(memRows)
    setTeams(teamRows)
    const next = {}
    teamRows.forEach((t) => {
      const id = t.id
      next[id] = t.captain_user_id != null ? String(t.captain_user_id) : ''
    })
    setDraftByTeamId(next)
  }, [open, sid, lid])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        await loadData()
      } catch {
        if (!cancelled) {
          setMembers([])
          setTeams([])
          setDraftByTeamId({})
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, loadData])

  const memberOptions = useMemo(
    () =>
      [...members].sort((a, b) =>
        String(memberLabel(a)).localeCompare(String(memberLabel(b))),
      ),
    [members],
  )

  const setCaptainDraft = (teamId, value) => {
    setDraftByTeamId((prev) => ({ ...prev, [teamId]: value }))
  }

  const run = async (fn) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      window.alert(err?.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveTeam = (team) => {
    const tid = team.id
    const raw = draftByTeamId[tid]
    const uid = raw ? Number.parseInt(String(raw), 10) : NaN
    if (raw && Number.isNaN(uid)) {
      window.alert('Pick a valid member as captain, or clear the selection.')
      return
    }
    run(async () => {
      await apiFetch(`/api/sessions/${sid}/teams/${tid}/captain`, {
        method: 'PATCH',
        body: JSON.stringify({
          actingUserId: actorNumeric,
          captainUserId: raw ? uid : null,
        }),
      })
      await loadData()
      await onUpdated?.()
    })
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card session-captain-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-captain-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="session-captain-title" className="page-title">
            Choose captains
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {sessionTitle ? <p className="meta">{sessionTitle}</p> : null}
        <p className="meta">
          Captains must be league members. Assign one per team; changes apply to this session only.
        </p>

        {!teams.length ? (
          <p className="meta">No teams for this session yet. Add teams using Edit session.</p>
        ) : (
          <ul className="list-plain session-captain-modal__list">
            {teams.map((team) => (
              <li key={team.id} className="session-captain-modal__row card">
                <p className="session-title session-captain-modal__team-name">{team.name}</p>
                <label className="field">
                  <span className="field-label">Captain</span>
                  <select
                    className="field-input"
                    value={draftByTeamId[team.id] ?? ''}
                    onChange={(e) => setCaptainDraft(team.id, e.target.value)}
                    disabled={busy}
                  >
                    <option value="">No captain</option>
                    {memberOptions.map((r) => (
                      <option key={r.user_id} value={String(r.user_id)}>
                        {memberLabel(r)}
                      </option>
                    ))}
                  </select>
                </label>
                <PrimaryButton
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() => handleSaveTeam(team)}
                >
                  Save this team
                </PrimaryButton>
              </li>
            ))}
          </ul>
        )}

        <div className="button-row modal-actions">
          <SecondaryButton type="button" onClick={onClose} disabled={busy}>
            Done
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
