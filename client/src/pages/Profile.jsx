import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import ProfilePlayerLayout from '../components/ProfilePlayerLayout'
import SecondaryButton from '../components/SecondaryButton'
import SectionLabel from '../components/SectionLabel'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'

function Profile() {
  const navigate = useNavigate()
  const {
    players,
    activeLeague,
    currentUser,
    logout,
    getLeagueMemberRole,
    getLeaguePlayers,
    getPlayerIdentity,
    getPlayerAttributeProfile,
    updateCurrentUserProfileImage,
  } = useMockApp()
  const avatarInputRef = useRef(null)
  const [avatarHint, setAvatarHint] = useState('')
  const [dbSummary, setDbSummary] = useState(null)

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  const fallbackPlayer = {
    id: String(currentUser.playerId ?? `profile-${currentUser.id}`),
    name: currentUser.displayName,
    initials:
      currentUser.initials ||
      String(currentUser.displayName || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') ||
      'P',
    games: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    mvps: 0,
    winRate: 0,
    rating: 7,
    value: 10,
  }
  const leaguePlayers = activeLeague ? getLeaguePlayers(activeLeague.id) : players
  const me = leaguePlayers.find((p) => p.id === currentUser.playerId) ?? players.find((p) => p.id === currentUser.playerId) ?? fallbackPlayer
  const numericUserId = Number.parseInt(String(currentUser?.id ?? ''), 10)
  const isDbUser = !Number.isNaN(numericUserId) && String(numericUserId) === String(currentUser?.id ?? '')

  useEffect(() => {
    let cancelled = false
    if (!isDbUser) {
      setDbSummary(null)
      return undefined
    }
    ;(async () => {
      try {
        const leagueId = activeLeague?.id
        const query = /^\d+$/.test(String(leagueId || '')) ? `?leagueId=${Number.parseInt(String(leagueId), 10)}` : ''
        const result = await apiFetch(`/api/players/${numericUserId}/summary${query}`, { cache: 'no-store' })
        if (!cancelled) setDbSummary(result?.data ?? null)
      } catch {
        if (!cancelled) setDbSummary(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDbUser, numericUserId, activeLeague?.id])

  const myRoleInActive = activeLeague ? getLeagueMemberRole(activeLeague.id, currentUser.id) : null
  const identity = getPlayerIdentity(me.id, activeLeague?.id ?? null)
  const radarData = getPlayerAttributeProfile(me.id, activeLeague?.id ?? null)
  const heroOverall = Number(dbSummary?.ovr) || Math.round((me.overall ?? me.rating * 10) || 70)
  const heroArchetype = dbSummary?.main_archetype || (identity.hasVotes ? identity.mainArchetype : 'None')
  const heroWorth = Number(dbSummary?.total_worth ?? me.value ?? 10)
  const heroMvps = Number(dbSummary?.mvp_trophies ?? me.mvps ?? 0)
  const heroMatches = Number(dbSummary?.matches_played ?? me.games ?? 0)

  const triggerAvatarPicker = () => {
    avatarInputRef.current?.click()
  }

  const resizeAvatarImage = async (file) => {
    const imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Could not read file.'))
      reader.readAsDataURL(file)
    })

    if (!imageDataUrl) return ''

    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not process image.'))
      img.src = imageDataUrl
    })

    const maxSide = 360
    const scale = Math.min(1, maxSide / Math.max(image.width || 1, image.height || 1))
    const targetWidth = Math.max(1, Math.round((image.width || 1) * scale))
    const targetHeight = Math.max(1, Math.round((image.height || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return imageDataUrl
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

    // Gradually lower quality if needed so backend payload stays safely small.
    const qualitySteps = [0.88, 0.8, 0.72, 0.64, 0.56]
    for (const quality of qualitySteps) {
      const compressed = canvas.toDataURL('image/jpeg', quality)
      if (compressed.length <= 450_000) return compressed
    }
    return canvas.toDataURL('image/jpeg', 0.5)
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarHint('Please choose an image file.')
      setTimeout(() => setAvatarHint(''), 2200)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarHint('Image must be 2MB or smaller.')
      setTimeout(() => setAvatarHint(''), 2200)
      return
    }

    const imageDataUrl = await resizeAvatarImage(file).catch(() => '')

    if (!imageDataUrl) {
      setAvatarHint('Could not update photo.')
      setTimeout(() => setAvatarHint(''), 2200)
      return
    }

    const result = await updateCurrentUserProfileImage(imageDataUrl)
    setAvatarHint(result.ok ? 'Profile photo updated.' : 'Could not update photo.')
    setTimeout(() => setAvatarHint(''), 2200)
    event.target.value = ''
  }

  const accountDetails = {
    email: currentUser.email,
    displayName: currentUser.displayName,
    username: currentUser.username,
    phone: currentUser.phone,
    memberSince: currentUser.memberSince,
    playerId: currentUser.playerId ?? me.id,
  }

  const leagueBlock = (
    <>
      <SectionLabel>Active league</SectionLabel>
      <section className="card profile-league-card">
        {activeLeague ? (
          <>
            <p className="session-title">{activeLeague.name}</p>
            {myRoleInActive ? (
              <p className="meta" style={{ marginBottom: 8 }}>
                Your role in this league: <strong style={{ textTransform: 'capitalize' }}>{myRoleInActive}</strong>
              </p>
            ) : null}
            <p className="meta invite-code-line">
              Invite: <span className="invite-code">{activeLeague.inviteCode}</span>
            </p>
            <p className="meta">
              {activeLeague.memberCount} players · {activeLeague.sessionCount} sessions
            </p>
            <div className="button-row">
              <Link to="/league" className="w-full">
                <SecondaryButton className="w-full">League hub</SecondaryButton>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="meta">No active league selected.</p>
            <Link to="/league" className="profile-inline-link">
              Open league
            </Link>
          </>
        )}
      </section>
    </>
  )

  return (
    <>
      <ProfilePlayerLayout
        player={me}
        backTo={null}
        accountDetails={accountDetails}
        profileCardData={{
          greeting: 'Your profile,',
          displayName: currentUser.displayName,
          overall: heroOverall,
          totalWorth: heroWorth.toFixed(1),
          archetype: heroArchetype,
          mvpTrophies: heroMvps,
          matchesPlayed: heroMatches,
          avatarImage: currentUser.avatarImage ?? '',
          avatarFallback: me.initials,
          onAvatarClick: triggerAvatarPicker,
          avatarHint,
        }}
        identityExtra={
          <>
            <SecondaryButton
              type="button"
              className="w-full"
              onClick={() => {
                logout()
                navigate('/', { replace: true })
              }}
            >
              Log out
            </SecondaryButton>
          </>
        }
        radarData={radarData}
        afterRadar={leagueBlock}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        style={{ display: 'none' }}
      />
    </>
  )
}

export default Profile
