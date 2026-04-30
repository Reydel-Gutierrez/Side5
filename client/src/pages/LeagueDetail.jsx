import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { useMockApp } from '../context/MockAppContext'
import { sessionRosterIds } from '../utils/sessionRoster'
import { apiFetch } from '../utils/apiFetch'
import LeagueAdminModal from '../components/LeagueAdminModal'
import DeleteSessionModal from '../components/DeleteSessionModal'

function mapApiSessionRow(s) {
  const timeRaw = s.session_time != null ? String(s.session_time) : ''
  const timeShort = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw
  return {
    id: String(s.id),
    leagueId: String(s.league_id),
    title: s.title,
    date: s.session_date,
    time: timeShort,
    dateIso: s.session_date,
    time24: timeShort,
    status: s.status || 'open',
    maxPlayers: 10,
    players: [],
  }
}

function sortApiMembers(rows) {
  const order = { owner: 0, manager: 1, player: 2 }
  return [...rows].sort((a, b) => {
    const ra = order[a.role] ?? 9
    const rb = order[b.role] ?? 9
    if (ra !== rb) return ra - rb
    return String(a.display_name || '').localeCompare(String(b.display_name || ''))
  })
}

function initialsFromDisplayName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function normalizeApiMember(member) {
  const rating = Number(member.rating) || 0
  return {
    key: `api-${member.user_id}`,
    userId: member.user_id,
    name: member.display_name || member.username || 'Player',
    initials: initialsFromDisplayName(member.display_name || member.username || ''),
    value: Number(member.base_value) || 0,
    overall: Number(member.ovr) || Math.round(rating * 10),
    archetype: member.main_archetype || 'None',
    primaryRole: member.role || 'player',
    isCaptain: Boolean(Number(member.is_team_captain)),
    profileId: String(member.user_id),
    avatarImage: member.avatar_image || '',
  }
}

function formatLeagueRole(role) {
  const normalized = String(role || 'player').toLowerCase()
  if (normalized === 'owner') return 'Owner'
  if (normalized === 'manager') return 'Manager'
  return 'Player'
}

function LeagueDetail() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [apiMembers, setApiMembers] = useState(null)
  const [resolvedApiLeagueId, setResolvedApiLeagueId] = useState(null)
  const [apiLeagueSessions, setApiLeagueSessions] = useState([])
  const {
    leaguesDisplay,
    sessions,
    currentUserId,
    activeLeague,
    getLeagueMemberRole,
    canManageLeague,
    isLeagueOwner,
    leaveLeague,
    refreshLeaguesFromApi,
    deleteSession,
  } = useMockApp()

  const resolvedLeagueId = activeLeague?.id ?? leagueId ?? null
  const league = useMemo(
    () => leaguesDisplay.find((l) => String(l.id) === String(resolvedLeagueId)),
    [leaguesDisplay, resolvedLeagueId],
  )

  useEffect(() => {
    let cancelled = false
    const uid = Number.parseInt(String(currentUserId ?? ''), 10)
    const currentLeagueId = String(resolvedLeagueId ?? '')

    if (!Number.isNaN(uid) && String(uid) === String(currentUserId) && /^\d+$/.test(currentLeagueId)) {
      setResolvedApiLeagueId(Number.parseInt(currentLeagueId, 10))
      return undefined
    }

    if (Number.isNaN(uid) || String(uid) !== String(currentUserId)) {
      setResolvedApiLeagueId(null)
      return undefined
    }

    ;(async () => {
      try {
        const result = await apiFetch(`/api/leagues/mine?userId=${uid}`, { cache: 'no-store' })
        const rows = Array.isArray(result?.data) ? result.data : []
        const inviteCode = String(league?.inviteCode ?? '').trim().toUpperCase()
        const name = String(league?.name ?? '').trim().toLowerCase()
        const matched =
          rows.find((row) => String(row.invite_code ?? '').trim().toUpperCase() === inviteCode) ??
          rows.find((row) => String(row.name ?? '').trim().toLowerCase() === name) ??
          null
        if (!cancelled) setResolvedApiLeagueId(matched?.id ?? null)
      } catch {
        if (!cancelled) setResolvedApiLeagueId(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentUserId, resolvedLeagueId, league?.inviteCode, league?.name])

  const useApiMembers = Number.isInteger(resolvedApiLeagueId)

  const refreshApiMembers = useCallback(async () => {
    if (!useApiMembers || !resolvedApiLeagueId) return
    try {
      const res = await apiFetch(`/api/leagues/${resolvedApiLeagueId}/members`, { cache: 'no-store' })
      setApiMembers(Array.isArray(res?.data) ? res.data : [])
    } catch {
      setApiMembers([])
    }
  }, [useApiMembers, resolvedApiLeagueId])

  const onManagementRefresh = useCallback(async () => {
    await refreshApiMembers()
    if (typeof refreshLeaguesFromApi === 'function') {
      await refreshLeaguesFromApi()
    }
  }, [refreshApiMembers, refreshLeaguesFromApi])

  const confirmDeleteSession = useCallback(
    async (session) => {
      const sid = session?.id
      if (sid == null) return { ok: false, reason: 'Invalid session.' }
      const result = await deleteSession(sid, league?.id ?? resolvedLeagueId)
      if (!result.ok) {
        return result
      }
      if (useApiMembers) {
        setApiLeagueSessions((prev) => prev.filter((s) => String(s.id) !== String(sid)))
      }
      if (typeof refreshLeaguesFromApi === 'function') {
        await refreshLeaguesFromApi()
      }
      return result
    },
    [deleteSession, refreshLeaguesFromApi, useApiMembers, league?.id, resolvedLeagueId],
  )

  useEffect(() => {
    if (!useApiMembers) {
      setApiMembers(null)
      return undefined
    }
    let cancelled = false

    refreshApiMembers()

    const intervalId = window.setInterval(() => {
      if (!cancelled) refreshApiMembers()
    }, 5000)
    const onWindowFocus = () => {
      if (!cancelled) refreshApiMembers()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) refreshApiMembers()
    }
    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [useApiMembers, resolvedApiLeagueId, refreshApiMembers])

  useEffect(() => {
    if (!useApiMembers || !resolvedApiLeagueId) {
      setApiLeagueSessions([])
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const sessionsRes = await apiFetch('/api/sessions', { cache: 'no-store' })
        const allSessions = Array.isArray(sessionsRes?.data) ? sessionsRes.data : []
        const filtered = allSessions.filter((s) => Number(s.league_id) === Number(resolvedApiLeagueId))
        if (!cancelled) setApiLeagueSessions(filtered)
      } catch {
        if (!cancelled) setApiLeagueSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [useApiMembers, resolvedApiLeagueId])

  if (!league) return <Navigate to="/league" replace />
  if (leagueId && String(leagueId) !== String(resolvedLeagueId)) return <Navigate to="/league" replace />

  const leagueSessions = sessions
    .filter((s) => String(s.leagueId) === String(league.id))
    .sort((a, b) => `${b.dateIso}T${b.time24}`.localeCompare(`${a.dateIso}T${a.time24}`))

  const sortedApiMembers = apiMembers ? sortApiMembers(apiMembers) : []
  const displayMembers = useApiMembers ? sortedApiMembers.map(normalizeApiMember) : []
  const myRole = currentUserId ? getLeagueMemberRole(league.id, currentUserId) : null
  const amLeagueOwner = Boolean(league?.id && isLeagueOwner(league.id))
  const actingUserNumeric = Number.parseInt(String(currentUserId ?? ''), 10)
  const canUseDbLeagueTools =
    useApiMembers &&
    Number.isInteger(resolvedApiLeagueId) &&
    !Number.isNaN(actingUserNumeric) &&
    String(actingUserNumeric) === String(currentUserId)

  const sessionsToShow =
    useApiMembers && apiLeagueSessions.length > 0
      ? [...apiLeagueSessions]
          .sort((a, b) => `${a.session_date}T${String(a.session_time).slice(0, 8)}`.localeCompare(`${b.session_date}T${String(b.session_time).slice(0, 8)}`))
          .map(mapApiSessionRow)
      : leagueSessions

  return (
    <div className="screen">
      <PageHeader title={league.name} />

      <section className="card">
        <p className="meta">{league.description}</p>
        <p className="meta invite-code-line">
          Invite code: <span className="invite-code">{league.inviteCode}</span>
        </p>
        <p className="meta">
          {league.memberCount} players · {league.sessionCount} sessions
        </p>
        {canManageLeague(league.id) || (amLeagueOwner && canUseDbLeagueTools) || myRole ? (
          <div className="league-card-actions">
            {canManageLeague(league.id) ? (
              <Link to="/sessions?new=1" className="league-card-actions__item">
                <PrimaryButton className="w-full">Create Session</PrimaryButton>
              </Link>
            ) : null}
            {amLeagueOwner && canUseDbLeagueTools ? (
              <SecondaryButton type="button" className="league-card-actions__item" onClick={() => setAdminModalOpen(true)}>
                League administration
              </SecondaryButton>
            ) : null}
            {myRole ? (
              !confirmLeaveOpen ? (
                <SecondaryButton type="button" className="league-card-actions__item" onClick={() => setConfirmLeaveOpen(true)}>
                  Leave League
                </SecondaryButton>
              ) : (
                <>
                  <SecondaryButton type="button" className="league-card-actions__item" onClick={() => setConfirmLeaveOpen(false)}>
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    className="league-card-actions__item"
                    onClick={async () => {
                      const result = await leaveLeague(league.id)
                      if (!result.ok) {
                        window.alert(result.reason)
                        return
                      }
                      navigate('/', { replace: true })
                    }}
                  >
                    Confirm Leave
                  </PrimaryButton>
                </>
              )
            ) : null}
          </div>
        ) : null}
      </section>

      <DeleteSessionModal
        open={Boolean(sessionToDelete)}
        session={sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDeleteSession}
      />

      {amLeagueOwner && canUseDbLeagueTools ? (
        <LeagueAdminModal
          open={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
          panelProps={{
            leagueId: resolvedApiLeagueId,
            actingUserId: actingUserNumeric,
            apiMembersRows: sortedApiMembers,
            onRefreshAll: onManagementRefresh,
          }}
        />
      ) : null}

      <p className="section-label">Sessions in this league</p>
      {sessionsToShow.length === 0 ? (
        <section className="card">
          <p className="meta">No sessions yet. Create one from Sessions or from this page.</p>
        </section>
      ) : (
        <ul className="list-plain">
          {sessionsToShow.map((session) => (
            <li key={session.id} className="card list-card-tight">
              <p className="session-title">{session.title}</p>
              <p className="meta">
                {session.date} · {session.time}
              </p>
              <p className="meta">
                {sessionRosterIds(session).length} / {session.maxPlayers ?? 10} players · {session.status.replace('_', ' ')}
              </p>
              {canManageLeague(league.id) ? (
                <div className="button-row league-session-card-actions">
                  <Link to={`/sessions/${session.id}`} className="w-full">
                    <SecondaryButton className="w-full">Open</SecondaryButton>
                  </Link>
                  <SecondaryButton type="button" className="w-full" onClick={() => setSessionToDelete(session)}>
                    Delete
                  </SecondaryButton>
                </div>
              ) : (
                <Link to={`/sessions/${session.id}`}>
                  <SecondaryButton className="w-full">Open</SecondaryButton>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="section-label">Members</p>
      <section className="card">
        <div className="screen-stack league-members-grid">
          {!useApiMembers ? (
            <p className="meta">
              Member roster is loaded from the database when this league is linked to your signed-in account.
            </p>
          ) : null}
          {useApiMembers && apiMembers === null ? <p className="meta">Loading members…</p> : null}
          {displayMembers.map((member) => {
            const metricsTail = ` · OVR ${member.overall ?? 'N/A'} · $${member.value.toFixed(1)}M · ${member.archetype || 'None'} · ${formatLeagueRole(member.primaryRole)}${
              member.isCaptain ? ' · Capt' : ''
            }`
            return (
              <Link
                key={member.key}
                to={`/players/${member.profileId}?from=league`}
                className="league-member-mini-card"
                title={`${member.name}${metricsTail}`}
                aria-label={`${member.name}${metricsTail}`}
              >
                <div className="avatar league-member-mini-card__avatar">
                  {member.avatarImage ? (
                    <img src={member.avatarImage} alt="" className="hero-card-main__avatar-image" />
                  ) : (
                    member.initials
                  )}
                </div>
                <div className="league-member-mini-card__body">
                  <span className="league-member-mini-card__name">{member.name}</span>
                  <span className="league-member-mini-card__metrics">{metricsTail}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default LeagueDetail
