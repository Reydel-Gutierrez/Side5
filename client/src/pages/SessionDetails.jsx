import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, Navigate, useParams } from "react-router-dom";

import PrimaryButton from "../components/PrimaryButton";

import SecondaryButton from "../components/SecondaryButton";

import SessionFormModal from "../components/SessionFormModal";

import SessionCaptainModal from "../components/SessionCaptainModal";

import StatusChip from "../components/StatusChip";

import { useMockApp } from "../context/MockAppContext";

import { apiFetch } from "../utils/apiFetch";

import { sessionStatusTone } from "../utils/sessionStatus";
import { isPastSession } from "../utils/sessionPast";

function SessionDetailIcon({ name }) {
  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />

        <path
          d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "pin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        <circle
          cx="12"
          cy="11"
          r="2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (name === "lock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="5"
          y="11"
          width="14"
          height="10"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />

        <path
          d="M8 11V8a4 4 0 0 1 8 0v3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M15 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />

        <path
          d="M4 20a8 8 0 0 1 16 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return null;
}

function initialsFromDisplayName(name) {
  return (
    String(name || "")
      .split(/\s+/)

      .filter(Boolean)

      .slice(0, 2)

      .map((part) => part[0]?.toUpperCase() ?? "")

      .join("") || "?"
  );
}

function sessionEyebrow(session) {
  if (!session?.session_date) return "Session";

  const d = new Date(session.session_date);

  if (Number.isNaN(d.getTime())) return "Session";

  return d.toLocaleDateString(undefined, { weekday: "long" });
}

function formatSessionDateTime(session) {
  if (!session?.session_date) return "";

  const d = session.session_date;

  const dateStr =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)
      ? d.slice(0, 10)
      : String(d).slice(0, 10);

  const rawTime =
    session.session_time != null
      ? String(session.session_time).slice(0, 5)
      : "";

  if (!rawTime) return dateStr;

  const [hh, mm] = rawTime.split(":").map((part) => Number.parseInt(part, 10));

  if (!Number.isFinite(hh)) return `${dateStr} \u00b7 ${rawTime}`;

  const period = hh >= 12 ? "PM" : "AM";

  const hour12 = hh % 12 || 12;

  const minutePart = Number.isFinite(mm)
    ? `:${String(mm).padStart(2, "0")}`
    : "";

  return `${dateStr} \u00b7 ${hour12}${minutePart} ${period}`;
}

function rosterAttendanceChip(status) {
  const s = String(status || "").toLowerCase();

  if (s === "confirmed") {
    return (
      <StatusChip tone="confirmed" className="session-detail-joined-chip">
        Joined &#10003;
      </StatusChip>
    );
  }

  if (s === "declined") {
    return <StatusChip tone="orange">Declined</StatusChip>;
  }

  return <StatusChip tone="invited">Invited</StatusChip>;
}

function SessionDetails() {
  const { sessionId } = useParams();

  const {
    canManageLeague,
    updateSession,
    currentUser,
    currentUserId,
    refreshSessionsFromApi,
  } = useMockApp();

  const [session, setSession] = useState(null);

  const [roster, setRoster] = useState([]);

  const [sessionTeams, setSessionTeams] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [editOpen, setEditOpen] = useState(false);

  const [captainOpen, setCaptainOpen] = useState(false);

  const reloadSession = useCallback(async () => {
    const response = await apiFetch(`/api/sessions/${sessionId}`);

    const sessionData = response?.data || null;

    setSession(sessionData);

    setRoster(Array.isArray(sessionData?.players) ? sessionData.players : []);

    try {
      const teamsRes = await apiFetch(`/api/sessions/${sessionId}/teams`, {
        cache: "no-store",
      });

      setSessionTeams(Array.isArray(teamsRes?.data) ? teamsRes.data : []);
    } catch {
      setSessionTeams([]);
    }

    try {
      await refreshSessionsFromApi?.();
    } catch {
      /* keep session details usable even if context refresh fails */
    }
  }, [sessionId, refreshSessionsFromApi]);

  useEffect(() => {
    let active = true;

    (async () => {
      setIsLoading(true);

      setError("");

      try {
        const response = await apiFetch(`/api/sessions/${sessionId}`);

        if (!active) return;

        const sessionData = response?.data || null;

        setSession(sessionData);

        setRoster(
          Array.isArray(sessionData?.players) ? sessionData.players : [],
        );

        try {
          const teamsRes = await apiFetch(`/api/sessions/${sessionId}/teams`, {
            cache: "no-store",
          });

          if (!active) return;

          setSessionTeams(Array.isArray(teamsRes?.data) ? teamsRes.data : []);
        } catch {
          if (active) setSessionTeams([]);
        }
      } catch (requestError) {
        if (!active) return;

        setError(requestError.message || "Failed to load session details.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [sessionId]);

  const headerDateTime = useMemo(
    () => formatSessionDateTime(session),
    [session],
  );

  const sessionDayLabel = useMemo(() => sessionEyebrow(session), [session]);

  const memberCap = useMemo(() => Math.max(1, roster.length), [roster]);

  const captainUserIds = useMemo(() => {
    const ids = new Set();

    for (const team of sessionTeams) {
      if (team?.captain_user_id != null) ids.add(String(team.captain_user_id));
    }

    return ids;
  }, [sessionTeams]);

  const myAttendance = useMemo(() => {
    if (!currentUser?.id) return null;

    return (
      roster.find((p) => String(p.user_id) === String(currentUser.id)) ?? null
    );
  }, [roster, currentUser?.id]);

  const hasJoined = myAttendance?.status === "confirmed";

  if (isLoading) {
    return (
      <div className="screen screen--session-detail">
        <div className="session-detail-hero session-detail-hero--loading">
          <div className="session-detail-skeleton session-detail-skeleton--eyebrow" />

          <div className="session-detail-skeleton session-detail-skeleton--title" />

          <div className="session-detail-skeleton session-detail-skeleton--meta" />
        </div>

        <section className="card session-detail-info">
          <p className="meta">Loading session…</p>
        </section>
      </div>
    );
  }

  if (!session) return <Navigate to="/sessions" replace />;

  if (isPastSession(session)) {
    return <Navigate to={`/game-hub/${sessionId}`} replace />;
  }

  const canManage = Boolean(
    session.league_id != null && canManageLeague(String(session.league_id)),
  );

  const actingUserNumeric = Number.parseInt(String(currentUserId ?? ""), 10);

  const sessionIdLooksNumeric = /^\d+$/.test(String(sessionId));

  const canUseSessionCaptainUi =
    canManage &&
    sessionIdLooksNumeric &&
    Number.isInteger(actingUserNumeric) &&
    String(actingUserNumeric) === String(currentUserId);

  const statusLabel = session.status.replace(/_/g, " ");

  const statusTone = sessionStatusTone(session.status);

  const handleEditSubmit = async (payload) => {
    const result = await updateSession(session.id, payload, session.league_id);

    if (!result.ok) {
      window.alert(result.reason || "Could not update session.");

      return;
    }

    setEditOpen(false);

    try {
      await reloadSession();
    } catch (e) {
      window.alert(e?.message || "Saved, but failed to refresh the page.");
    }
  };

  const handleJoin = async () => {
    if (!currentUser?.id) return;

    try {
      await apiFetch(`/api/sessions/${session.id}/confirm`, {
        method: "POST",

        body: JSON.stringify({ userId: currentUser.id }),
      });

      const refreshed = await apiFetch(`/api/sessions/${sessionId}`);

      const sessionData = refreshed?.data || null;

      setSession(sessionData);

      setRoster(Array.isArray(sessionData?.players) ? sessionData.players : []);

      try {
        const teamsRes = await apiFetch(`/api/sessions/${sessionId}/teams`, {
          cache: "no-store",
        });

        setSessionTeams(Array.isArray(teamsRes?.data) ? teamsRes.data : []);
      } catch {
        setSessionTeams([]);
      }
    } catch (requestError) {
      window.alert(requestError.message || "Failed to join session.");
    }
  };

  return (
    <div className="screen screen--session-detail">
      <header className="session-detail-hero">
        <div className="session-detail-hero__bg" aria-hidden="true" />

        <div className="session-detail-hero__ball" aria-hidden="true" />

        <div className="session-detail-hero__content">
          <div className="session-detail-hero__row">
            <div className="session-detail-hero__text">
              <p className="session-detail-hero__eyebrow">{sessionDayLabel}</p>

              <h1 className="session-detail-hero__title">{session.title}</h1>

              {headerDateTime ? (
                <p className="session-detail-hero__datetime">
                  <SessionDetailIcon name="calendar" />

                  <span>{headerDateTime}</span>
                </p>
              ) : null}

              {session.league_name ? (
                <p className="session-detail-hero__league">
                  League: {session.league_name}
                </p>
              ) : null}
            </div>

            {canManage ? (
              <div className="session-detail-hero__actions">
                <SecondaryButton
                  type="button"
                  className="session-detail-btn"
                  onClick={() => setEditOpen(true)}
                >
                  Edit session
                </SecondaryButton>

                {canUseSessionCaptainUi ? (
                  <SecondaryButton
                    type="button"
                    className="session-detail-btn"
                    onClick={() => setCaptainOpen(true)}
                  >
                    Choose captain
                  </SecondaryButton>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <SessionFormModal
        open={editOpen}
        mode="edit"
        session={session}
        maxRoster={roster.length}
        getLeagueMemberPlayerCount={() => roster.length}
        leagues={[]}
        defaultLeagueId={session.league_id}
        existingTeams={sessionTeams}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      {canUseSessionCaptainUi ? (
        <SessionCaptainModal
          open={captainOpen}
          onClose={() => setCaptainOpen(false)}
          sessionId={sessionId}
          leagueId={session.league_id}
          actingUserId={actingUserNumeric}
          sessionTitle={session.title}
          onUpdated={reloadSession}
        />
      ) : null}

      <section className="card session-detail-info">
        {error ? (
          <p className="meta session-detail-info__error">{error}</p>
        ) : null}

        <div className="session-detail-info__location-row">
          <p className="session-detail-info__location">
            <SessionDetailIcon name="pin" />

            <span>{session.location || "Location TBD"}</span>
          </p>

          <StatusChip tone={statusTone} className="session-detail-status-chip">
            {statusLabel}
          </StatusChip>
        </div>

        <div className="session-detail-stats" role="list">
          <div className="session-detail-stat" role="listitem">
            <p className="session-detail-stat__label">Format</p>

            <p className="session-detail-stat__value">{session.format}</p>
          </div>

          <div className="session-detail-stat" role="listitem">
            <p className="session-detail-stat__label">Budget</p>

            <p className="session-detail-stat__value">
              <span className="session-detail-stat__accent">
                ${session.budget_per_team}M
              </span>

              <span className="session-detail-stat__suffix"> / team</span>
            </p>
          </div>

          <div className="session-detail-stat" role="listitem">
            <p className="session-detail-stat__label">Teams</p>

            <p className="session-detail-stat__value">{sessionTeams.length}</p>
          </div>

          <div className="session-detail-stat" role="listitem">
            <p className="session-detail-stat__label">Players</p>

            <p className="session-detail-stat__value">{roster.length}</p>
          </div>
        </div>
      </section>

      <div className="session-detail-cta-row">
        {hasJoined ? (
          <SecondaryButton
            type="button"
            disabled
            className="session-detail-cta session-detail-cta--joined w-full"
          >
            Joined &#10003;
          </SecondaryButton>
        ) : (
          <SecondaryButton
            type="button"
            className="session-detail-cta session-detail-cta--join w-full"
            onClick={handleJoin}
          >
            Join session
          </SecondaryButton>
        )}

        <Link to={`/draft/${session.id}`} className="session-detail-cta-link">
          <PrimaryButton className="session-detail-cta session-detail-cta--draft w-full">
            Advance to Draft
          </PrimaryButton>
        </Link>
      </div>

      <section className="card session-detail-players">
        <div className="session-detail-players__head">
          <span className="session-detail-players__icon" aria-hidden="true">
            <SessionDetailIcon name="users" />
          </span>

          <div>
            <h2 className="session-detail-players__title">
              Players ({roster.length})
            </h2>

            <p className="session-detail-players__sub">
              Players locked to confirmed league members ({roster.length}/
              {memberCap})
            </p>
          </div>
        </div>

        <div className="session-detail-roster">
          {roster.length === 0 ? (
            <p className="meta">No players on this session yet.</p>
          ) : null}

          {roster.map((player) => {
            const displayName =
              player.display_name || player.username || "Player";

            const initials = initialsFromDisplayName(displayName);

            const rating = Number(player.rating) || 0;

            const overall =
              Number(player.ovr) ||
              (rating > 0 ? Math.round(rating * 10) : "\u2014");

            const worth = Number(player.player_worth ?? player.base_value) || 0;

            const isCaptain = captainUserIds.has(String(player.user_id));

            const avatarSrc = player.avatar_image
              ? String(player.avatar_image).trim()
              : "";

            return (
              <Link
                key={player.user_id}
                to={`/players/${player.user_id}?from=session&sessionId=${encodeURIComponent(String(sessionId))}`}
                className="session-detail-player-row"
              >
                <div className="session-detail-player-row__avatar avatar">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt=""
                      className="hero-card-main__avatar-image"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div className="session-detail-player-row__main">
                  <div className="session-detail-player-row__name-row">
                    <span className="session-detail-player-row__name">
                      {displayName}
                    </span>

                    {isCaptain ? (
                      <span className="session-detail-captain-tag">
                        Captain
                      </span>
                    ) : null}
                  </div>

                  <p className="session-detail-player-row__metrics">
                    OVR {overall} <span aria-hidden="true">&middot;</span> $
                    {worth.toFixed(1)}M
                  </p>
                </div>

                <div className="session-detail-player-row__status">
                  {rosterAttendanceChip(player.status)}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <aside className="card session-detail-footnote">
        <span className="session-detail-footnote__icon" aria-hidden="true">
          <SessionDetailIcon name="lock" />
        </span>

        <div>
          <p className="session-detail-footnote__title">
            Teams will be locked after the draft.
          </p>

          <p className="session-detail-footnote__sub">
            Once locked, players can submit and review match stats.
          </p>
        </div>
      </aside>
    </div>
  );
}

export default SessionDetails;
