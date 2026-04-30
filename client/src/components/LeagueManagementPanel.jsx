import { useMemo, useState } from 'react'
import SecondaryButton from './SecondaryButton'
import { apiFetch } from '../utils/apiFetch'

function formatLeagueRole(role) {
  const normalized = String(role || 'player').toLowerCase()
  if (normalized === 'owner') return 'Owner'
  if (normalized === 'manager') return 'Manager'
  return 'Player'
}

export default function LeagueManagementPanel({
  leagueId,
  actingUserId,
  apiMembersRows,
  onRefreshAll,
  embeddedInModal = false,
  className = '',
}) {
  const [busy, setBusy] = useState(false)
  const [setOwnerTargetId, setSetOwnerTargetId] = useState('')
  const [roleTargetId, setRoleTargetId] = useState('')

  const actorNumeric = Number.parseInt(String(actingUserId), 10)
  const leagueNumeric = Number.parseInt(String(leagueId), 10)

  const memberOptions = useMemo(() => {
    const rows = Array.isArray(apiMembersRows) ? apiMembersRows : []
    return [...rows].sort((a, b) =>
      String(a.display_name || a.username || '').localeCompare(String(b.display_name || b.username || '')),
    )
  }, [apiMembersRows])

  const memberLabel = (row) => row.display_name || row.username || `User ${row.user_id}`

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

  const patchMemberRole = async (userId, role) => {
    await apiFetch(`/api/leagues/${leagueNumeric}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role, actingUserId: actorNumeric }),
    })
    await onRefreshAll?.()
  }

  const handleSetAsOwner = () => {
    const uid = Number.parseInt(String(setOwnerTargetId), 10)
    if (Number.isNaN(uid) || uid === actorNumeric) {
      window.alert('Choose a member to grant owner privileges.')
      return
    }
    if (
      !window.confirm(
        'Grant this member full owner privileges? They will be able to create sessions and manage the league alongside other owners.',
      )
    )
      return
    run(async () => {
      await patchMemberRole(uid, 'owner')
    })
  }

  const handlePromoteManager = () => {
    const uid = Number.parseInt(String(roleTargetId), 10)
    if (Number.isNaN(uid)) {
      window.alert('Choose a member.')
      return
    }
    run(async () => {
      await patchMemberRole(uid, 'manager')
    })
  }

  const handleDemoteToPlayer = () => {
    const uid = Number.parseInt(String(roleTargetId), 10)
    if (Number.isNaN(uid)) {
      window.alert('Choose a member.')
      return
    }
    if (!window.confirm('Remove manager role from this member? They will be a player.')) return
    run(async () => {
      await patchMemberRole(uid, 'player')
    })
  }

  const roleTargetRow = memberOptions.find((r) => String(r.user_id) === String(roleTargetId))
  const roleTargetLeagueRole = roleTargetRow?.role ? String(roleTargetRow.role).toLowerCase() : ''
  const setOwnerTargetRow = memberOptions.find((r) => String(r.user_id) === String(setOwnerTargetId))
  const setOwnerTargetLeagueRole = setOwnerTargetRow?.role ? String(setOwnerTargetRow.role).toLowerCase() : ''

  const rootClass = ['league-admin-panel', embeddedInModal ? 'league-admin-panel--modal' : '', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      {!embeddedInModal ? (
        <>
          <p className="session-title league-admin-panel__title">League administration</p>
          <p className="meta league-admin-panel__intro">All changes are saved to the database.</p>
        </>
      ) : null}

      <p className="meta league-admin-panel__section-desc">
        Session teams and captains are managed on each session&apos;s page (Edit session and Choose captain).
      </p>

      <div className="league-admin-panel__section">
        <p className="field-label league-admin-panel__section-label">League owners</p>
        <div className="league-admin-panel__row">
          <label className="field league-admin-panel__grow">
            <span className="field-label">Member</span>
            <select
              className="field-input"
              value={setOwnerTargetId}
              onChange={(e) => setSetOwnerTargetId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select member…</option>
              {memberOptions
                .filter((r) => Number(r.user_id) !== actorNumeric)
                .map((r) => (
                  <option key={r.user_id} value={String(r.user_id)}>
                    {memberLabel(r)} ({formatLeagueRole(r.role)})
                  </option>
                ))}
            </select>
          </label>
          <SecondaryButton
            type="button"
            className="league-admin-panel__action"
            disabled={busy || setOwnerTargetLeagueRole === 'owner'}
            onClick={handleSetAsOwner}
          >
            Set as Owner
          </SecondaryButton>
        </div>
      </div>

      <div className="league-admin-panel__section">
        <p className="field-label league-admin-panel__section-label">Manager / player roles</p>
        <div className="league-admin-panel__row league-admin-panel__row--wrap">
          <label className="field league-admin-panel__grow">
            <span className="field-label">Member</span>
            <select
              className="field-input"
              value={roleTargetId}
              onChange={(e) => setRoleTargetId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select member…</option>
              {memberOptions
                .filter((r) => Number(r.user_id) !== actorNumeric)
                .map((r) => (
                  <option key={r.user_id} value={String(r.user_id)}>
                    {memberLabel(r)} ({formatLeagueRole(r.role)})
                  </option>
                ))}
            </select>
          </label>
          <SecondaryButton
            type="button"
            className="league-admin-panel__action"
            disabled={busy || roleTargetLeagueRole !== 'player'}
            onClick={handlePromoteManager}
          >
            Make manager
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="league-admin-panel__action"
            disabled={busy || roleTargetLeagueRole !== 'manager'}
            onClick={handleDemoteToPlayer}
          >
            Set as player
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
