import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import ProfilePlayerLayout from '../components/ProfilePlayerLayout'
import SecondaryButton from '../components/SecondaryButton'
import { useMockApp } from '../context/MockAppContext'
import { useDbPlayerSummary } from '../hooks/useDbPlayerSummary'
import { safeNumber } from '../utils/safeNumber'
import { radarDataFromSummary } from '../constants/playStyles'

function LeagueShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3 4 6.5v5.8c0 4.8 3.4 9.3 8 10.7 4.6-1.4 8-5.9 8-10.7V6.5L12 3Z" />
      <path d="M9.5 12.2 11.2 14l3.8-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProfileSectionHead({ icon, children }) {
  return (
    <div className="home-section-head profile-section-head">
      <span className="home-section-head__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="home-section-head__label">{children}</p>
    </div>
  )
}

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
  const numericUserId = Number.parseInt(String(currentUser?.id ?? ''), 10)
  const isDbUser = !Number.isNaN(numericUserId) && String(numericUserId) === String(currentUser?.id ?? '')
  const { summary: dbSummary } = useDbPlayerSummary(
    isDbUser ? numericUserId : null,
    activeLeague?.id,
    isDbUser,
  )

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
  const meBase =
    leaguePlayers.find((p) => p.id === currentUser.playerId) ??
    players.find((p) => p.id === currentUser.playerId) ??
    fallbackPlayer
  const me = {
    ...meBase,
    games: safeNumber(dbSummary?.matches_played ?? meBase.games, 0),
    goals: safeNumber(dbSummary?.goals ?? meBase.goals, 0),
    mvps: safeNumber(dbSummary?.mvp_trophies ?? meBase.mvps, 0),
    rating: safeNumber(dbSummary?.rating ?? meBase.rating, 6),
    value: safeNumber(dbSummary?.player_worth ?? dbSummary?.total_worth ?? meBase.value, 10),
    overall: safeNumber(
      dbSummary?.ovr ?? meBase.overall,
      Math.round(safeNumber(dbSummary?.rating ?? meBase.rating, 6) * 10),
    ),
  }

  const myRoleInActive = activeLeague ? getLeagueMemberRole(activeLeague.id, currentUser.id) : null
  const identity = getPlayerIdentity(me.id, activeLeague?.id ?? null)
  const radarData = dbSummary
    ? radarDataFromSummary(dbSummary)
    : getPlayerAttributeProfile(me.id, activeLeague?.id ?? null)
  const heroOverall = safeNumber(dbSummary?.ovr ?? me.overall, me.overall)
  const heroArchetype = dbSummary?.main_archetype || (identity.hasVotes ? identity.mainArchetype : 'None')
  const heroArchetypeDescription = dbSummary?.archetype_description || null
  const heroWorth = safeNumber(dbSummary?.player_worth ?? dbSummary?.total_worth ?? me.value, 10)
  const heroMvps = safeNumber(dbSummary?.mvp_trophies ?? me.mvps, 0)
  const heroMatches = safeNumber(dbSummary?.matches_played ?? me.games, 0)

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
      <ProfileSectionHead icon={<LeagueShieldIcon />}>Active League</ProfileSectionHead>
      <section className="card home-league-card profile-league-card">
        {activeLeague ? (
          <>
            <div className="home-dashboard-card__body">
              <div className="home-dashboard-card__icon home-dashboard-card__icon--league" aria-hidden="true">
                <LeagueShieldIcon />
              </div>
              <div className="home-dashboard-card__content">
                <p className="home-dashboard-card__title">{activeLeague.name}</p>
                {myRoleInActive ? (
                  <p className="home-dashboard-card__meta">
                    Your role: <span className="profile-role-pill">{myRoleInActive}</span>
                  </p>
                ) : null}
                <p className="home-dashboard-card__meta">
                  {activeLeague.memberCount} players · {activeLeague.sessionCount} sessions
                </p>
                <p className="home-dashboard-card__meta home-dashboard-card__meta--accent">
                  Invite code: <span className="invite-code">{activeLeague.inviteCode}</span>
                </p>
              </div>
            </div>
            <div className="button-row home-card-actions">
              <Link to="/league" className="w-full">
                <SecondaryButton className="w-full home-btn-secondary home-btn-secondary--solo">
                  <span className="home-btn__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
                      <circle cx="12" cy="8" r="3" />
                    </svg>
                  </span>
                  League Hub
                </SecondaryButton>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="meta home-empty-hint">No active league selected.</p>
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
          archetypeDescription: heroArchetypeDescription,
          mvpTrophies: heroMvps,
          matchesPlayed: heroMatches,
          avatarImage: currentUser.avatarImage ?? '',
          avatarFallback: me.initials,
          onAvatarClick: triggerAvatarPicker,
          avatarHint,
        }}
        identityExtra={
          <SecondaryButton
            type="button"
            className="w-full home-btn-secondary profile-logout-btn"
            onClick={() => {
              logout()
              navigate('/', { replace: true })
            }}
          >
            Log out
          </SecondaryButton>
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
