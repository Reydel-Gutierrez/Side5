import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import StatusChip from "../components/StatusChip";
import { useMockApp } from "../context/MockAppContext";
import { formatDateFromIso, formatTimeDisplay } from "../utils/sessionDisplay";
import { sessionRosterCount } from "../utils/sessionRoster";
import { sessionStatusTone } from "../utils/sessionStatus";
import { apiFetch } from "../utils/apiFetch";
import {
  fetchSessionRosterMeta,
  mergeSessionRosterMeta,
} from "../utils/sessionListHelpers";
import LeagueAdminModal from "../components/LeagueAdminModal";
import DeleteSessionModal from "../components/DeleteSessionModal";

function LeagueSectionHead({ icon, children }) {
  return (
    <div className="home-section-head profile-section-head">
      <span className="home-section-head__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="home-section-head__label">{children}</p>
    </div>
  );
}

function LeagueShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M12 3 4 6.5v5.8c0 4.8 3.4 9.3 8 10.7 4.6-1.4 8-5.9 8-10.7V6.5L12 3Z" />
      <path
        d="M9.5 12.2 11.2 14l3.8-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function sortApiMembers(rows) {
  const order = { owner: 0, manager: 1, player: 2 };
  return [...rows].sort((a, b) => {
    const ra = order[a.role] ?? 9;
    const rb = order[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    return String(a.display_name || "").localeCompare(
      String(b.display_name || ""),
    );
  });
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

function normalizeApiMember(member) {
  const rating = Number(member.rating) || 0;
  return {
    key: `api-${member.user_id}`,
    userId: member.user_id,
    name: member.display_name || member.username || "Player",
    initials: initialsFromDisplayName(
      member.display_name || member.username || "",
    ),
    value: Number(member.player_worth ?? member.base_value) || 0,
    overall: Number(member.ovr) || Math.round(rating * 10),
    archetype: member.main_archetype || "None",
    primaryRole: member.role || "player",
    isCaptain: Boolean(Number(member.is_team_captain)),
    profileId: String(member.user_id),
    avatarImage: member.avatar_image || "",
  };
}

function formatLeagueRole(role) {
  const normalized = String(role || "player").toLowerCase();
  if (normalized === "owner") return "Owner";
  if (normalized === "manager") return "Manager";
  return "Player";
}

function LeagueDetail() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [apiMembers, setApiMembers] = useState(null);
  const [resolvedApiLeagueId, setResolvedApiLeagueId] = useState(null);
  const [sessionRosterMeta, setSessionRosterMeta] = useState({});
  const pollInFlightRef = useRef(false);
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
    refreshSessionsFromApi,
    deleteSession,
  } = useMockApp();
  const sessionsRef = useRef(sessions);

  const resolvedLeagueId = activeLeague?.id ?? leagueId ?? null;
  const league = useMemo(
    () => leaguesDisplay.find((l) => String(l.id) === String(resolvedLeagueId)),
    [leaguesDisplay, resolvedLeagueId],
  );

  useEffect(() => {
    let cancelled = false;
    const uid = Number.parseInt(String(currentUserId ?? ""), 10);
    const currentLeagueId = String(resolvedLeagueId ?? "");

    if (
      !Number.isNaN(uid) &&
      String(uid) === String(currentUserId) &&
      /^\d+$/.test(currentLeagueId)
    ) {
      setResolvedApiLeagueId(Number.parseInt(currentLeagueId, 10));
      return undefined;
    }

    if (Number.isNaN(uid) || String(uid) !== String(currentUserId)) {
      setResolvedApiLeagueId(null);
      return undefined;
    }

    (async () => {
      try {
        const result = await apiFetch(`/api/leagues/mine?userId=${uid}`, {
          cache: "no-store",
        });
        const rows = Array.isArray(result?.data) ? result.data : [];
        const inviteCode = String(league?.inviteCode ?? "")
          .trim()
          .toUpperCase();
        const name = String(league?.name ?? "")
          .trim()
          .toLowerCase();
        const matched =
          rows.find(
            (row) =>
              String(row.invite_code ?? "")
                .trim()
                .toUpperCase() === inviteCode,
          ) ??
          rows.find(
            (row) =>
              String(row.name ?? "")
                .trim()
                .toLowerCase() === name,
          ) ??
          null;
        if (!cancelled) setResolvedApiLeagueId(matched?.id ?? null);
      } catch {
        if (!cancelled) setResolvedApiLeagueId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, resolvedLeagueId, league?.inviteCode, league?.name]);

  const useApiMembers = Number.isInteger(resolvedApiLeagueId);

  const refreshApiMembers = useCallback(async () => {
    if (!useApiMembers || !resolvedApiLeagueId) return;
    try {
      const res = await apiFetch(
        `/api/leagues/${resolvedApiLeagueId}/members`,
        { cache: "no-store" },
      );
      setApiMembers(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setApiMembers([]);
    }
  }, [useApiMembers, resolvedApiLeagueId]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const leagueIdKey = league?.id != null ? String(league.id) : "";

  const leagueSessionsBase = useMemo(() => {
    if (!leagueIdKey) return [];
    return sessions
      .filter((s) => String(s.leagueId) === leagueIdKey)
      .sort((a, b) =>
        `${a.dateIso}T${a.time24}`.localeCompare(`${b.dateIso}T${b.time24}`),
      );
  }, [sessions, leagueIdKey]);

  const leagueSessionIdsKey = useMemo(
    () => leagueSessionsBase.map((s) => s.id).join(","),
    [leagueSessionsBase],
  );

  const memberCountRef = useRef(league?.memberCount);
  useEffect(() => {
    memberCountRef.current = league?.memberCount;
  }, [league?.memberCount]);

  const refreshSessionRosters = useCallback(
    async (sessionRows) => {
      if (!useApiMembers || !sessionRows.length) return;
      const fallbackMax = Math.max(10, Number(memberCountRef.current) || 10);
      const entries = await Promise.all(
        sessionRows.map(async (session) => {
          const meta = await fetchSessionRosterMeta(session.id, fallbackMax);
          return [String(session.id), meta];
        }),
      );
      setSessionRosterMeta((prev) => {
        const next = { ...prev };
        entries.forEach(([id, meta]) => {
          const existing = prev[id];
          if (
            existing &&
            existing.rosterCount === meta.rosterCount &&
            existing.maxPlayers === meta.maxPlayers &&
            JSON.stringify(existing.playerIds) ===
              JSON.stringify(meta.playerIds)
          ) {
            next[id] = existing;
          } else {
            next[id] = meta;
          }
        });
        return next;
      });
    },
    [useApiMembers],
  );

  const pollLeagueData = useCallback(async () => {
    if (!leagueIdKey || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      if (typeof refreshSessionsFromApi === "function") {
        await refreshSessionsFromApi();
      }
      const rows = sessionsRef.current
        .filter((s) => String(s.leagueId) === leagueIdKey)
        .sort((a, b) =>
          `${a.dateIso}T${a.time24}`.localeCompare(`${b.dateIso}T${b.time24}`),
        );
      await refreshSessionRosters(rows);
    } finally {
      pollInFlightRef.current = false;
    }
  }, [leagueIdKey, refreshSessionsFromApi, refreshSessionRosters]);

  const onManagementRefresh = useCallback(async () => {
    if (typeof refreshLeaguesFromApi === "function") {
      await refreshLeaguesFromApi();
    }
    await refreshApiMembers();
    await pollLeagueData();
  }, [refreshApiMembers, refreshLeaguesFromApi, pollLeagueData]);

  const confirmDeleteSession = useCallback(
    async (session) => {
      const sid = session?.id;
      if (sid == null) return { ok: false, reason: "Invalid session." };
      const result = await deleteSession(sid, league?.id ?? resolvedLeagueId);
      if (!result.ok) {
        return result;
      }
      setSessionRosterMeta((prev) => {
        const next = { ...prev };
        delete next[String(sid)];
        return next;
      });
      await pollLeagueData();
      return result;
    },
    [deleteSession, league?.id, pollLeagueData, resolvedLeagueId],
  );

  useEffect(() => {
    if (!useApiMembers) {
      setApiMembers(null);
      return undefined;
    }
    let cancelled = false;

    refreshApiMembers();

    const intervalId = window.setInterval(() => {
      if (!cancelled) refreshApiMembers();
    }, 30000);
    const onWindowFocus = () => {
      if (!cancelled) refreshApiMembers();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !cancelled)
        refreshApiMembers();
    };
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [useApiMembers, resolvedApiLeagueId, refreshApiMembers]);

  useEffect(() => {
    if (!leagueIdKey) return undefined;
    let cancelled = false;

    const run = () => {
      if (!cancelled) pollLeagueData();
    };
    run();

    const intervalId = window.setInterval(run, 20000);
    const onWindowFocus = run;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [leagueIdKey, pollLeagueData]);

  useEffect(() => {
    if (!useApiMembers || !leagueIdKey || !leagueSessionIdsKey)
      return undefined;
    let cancelled = false;
    const rows = sessionsRef.current
      .filter((s) => String(s.leagueId) === leagueIdKey)
      .sort((a, b) =>
        `${a.dateIso}T${a.time24}`.localeCompare(`${b.dateIso}T${b.time24}`),
      );
    (async () => {
      if (!cancelled) await refreshSessionRosters(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [useApiMembers, leagueIdKey, leagueSessionIdsKey, refreshSessionRosters]);

  if (!league) return <Navigate to="/league" replace />;
  if (leagueId && String(leagueId) !== String(resolvedLeagueId))
    return <Navigate to="/league" replace />;

  const sortedApiMembers = apiMembers ? sortApiMembers(apiMembers) : [];
  const displayMembers = useApiMembers
    ? sortedApiMembers.map(normalizeApiMember)
    : [];
  const myRole = currentUserId
    ? getLeagueMemberRole(league.id, currentUserId)
    : null;
  const amLeagueOwner = Boolean(league?.id && isLeagueOwner(league.id));
  const actingUserNumeric = Number.parseInt(String(currentUserId ?? ""), 10);
  const canUseDbLeagueTools =
    useApiMembers &&
    Number.isInteger(resolvedApiLeagueId) &&
    !Number.isNaN(actingUserNumeric) &&
    String(actingUserNumeric) === String(currentUserId);

  const sessionsToShow = leagueSessionsBase.map((session) =>
    mergeSessionRosterMeta(session, sessionRosterMeta),
  );

  return (
    <div className="screen league-screen">
      <header className="profile-page-brand league-page-brand">
        <div className="profile-page-brand__texture" aria-hidden="true" />
        <h1 className="profile-page-brand__title league-page-brand__title">
          {league.name}
        </h1>
        <p className="profile-page-brand__tagline league-page-brand__tagline">
          {league.description ? (
            league.description
          ) : (
            <>
              Run your league.{" "}
              <span className="profile-page-brand__tagline-accent">
                Own game night.
              </span>
            </>
          )}
        </p>
      </header>

      <section className="card home-league-card league-hub-card">
        <div className="home-dashboard-card__body">
          <div
            className="home-dashboard-card__icon home-dashboard-card__icon--league"
            aria-hidden="true"
          >
            <LeagueShieldIcon />
          </div>
          <div className="home-dashboard-card__content">
            <p className="home-dashboard-card__title">League hub</p>
            <p className="home-dashboard-card__meta">
              {league.memberCount} players · {league.sessionCount} sessions
            </p>
            <p className="home-dashboard-card__meta home-dashboard-card__meta--accent">
              Invite code:{" "}
              <span className="invite-code">{league.inviteCode}</span>
            </p>
            {myRole ? (
              <p className="home-dashboard-card__meta">
                Your role:{" "}
                <span className="profile-role-pill">
                  {formatLeagueRole(myRole)}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        {canManageLeague(league.id) ||
        (amLeagueOwner && canUseDbLeagueTools) ||
        myRole ? (
          <div className="league-hub-card__actions">
            {canManageLeague(league.id) ? (
              <Link to="/sessions?new=1" className="w-full">
                <PrimaryButton className="w-full home-btn-primary">
                  <span className="home-btn__icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <rect x="4" y="5" width="16" height="14" rx="2.5" />
                      <path
                        d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16M12 13v4M10 15h4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  Create Session
                </PrimaryButton>
              </Link>
            ) : null}
            {amLeagueOwner && canUseDbLeagueTools ? (
              <SecondaryButton
                type="button"
                className="w-full home-btn-secondary"
                onClick={() => setAdminModalOpen(true)}
              >
                League Administration
              </SecondaryButton>
            ) : null}
            {myRole ? (
              !confirmLeaveOpen ? (
                <SecondaryButton
                  type="button"
                  className="w-full home-btn-secondary"
                  onClick={() => setConfirmLeaveOpen(true)}
                >
                  Leave League
                </SecondaryButton>
              ) : (
                <div className="button-row home-card-actions">
                  <SecondaryButton
                    type="button"
                    className="w-full home-btn-secondary"
                    onClick={() => setConfirmLeaveOpen(false)}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    className="w-full home-btn-primary"
                    onClick={async () => {
                      const result = await leaveLeague(league.id);
                      if (!result.ok) {
                        window.alert(result.reason);
                        return;
                      }
                      navigate("/", { replace: true });
                    }}
                  >
                    Confirm Leave
                  </PrimaryButton>
                </div>
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

      <LeagueSectionHead
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <rect x="4" y="5" width="16" height="14" rx="2.5" />
            <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" strokeLinecap="round" />
          </svg>
        }
      >
        Sessions
      </LeagueSectionHead>

      {sessionsToShow.length === 0 ? (
        <section className="card profile-panel-card league-empty-card">
          <p className="meta home-empty-hint">
            No sessions yet. Create one to get game night on the calendar.
          </p>
          {canManageLeague(league.id) ? (
            <Link to="/sessions?new=1" className="w-full">
              <PrimaryButton className="w-full home-btn-primary">
                Create Session
              </PrimaryButton>
            </Link>
          ) : null}
        </section>
      ) : (
        <ul className="list-plain league-sessions-list">
          {sessionsToShow.map((session) => {
            const rosterCount = sessionRosterCount(session);
            const maxPlayers =
              session.maxPlayers ??
              Math.max(10, Number(league.memberCount) || 10);
            const tone = sessionStatusTone(session.status);
            const statusLabel = String(session.status || "open").replace(
              /_/g,
              " ",
            );
            const dateLabel =
              session.date || formatDateFromIso(session.dateIso);
            const timeLabel = session.time || formatTimeDisplay(session.time24);

            return (
              <li
                key={session.id}
                className="card home-session-card league-session-card"
              >
                <div className="home-dashboard-card__body">
                  <div
                    className="home-dashboard-card__icon home-dashboard-card__icon--pitch"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="4" y="5" width="16" height="14" rx="2" />
                      <path d="M12 5v14M4 12h16" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="2.2" />
                    </svg>
                  </div>
                  <div className="home-dashboard-card__content">
                    <div className="home-session-card__title-row">
                      <p className="home-dashboard-card__title">
                        {session.title}
                      </p>
                      <StatusChip
                        tone={tone}
                        className="home-session-card__status"
                      >
                        {statusLabel}
                      </StatusChip>
                    </div>
                    <p className="home-dashboard-card__meta">
                      <span>{dateLabel}</span>
                      {timeLabel ? (
                        <>
                          <span
                            className="home-session-card__meta-sep"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                          <span>{timeLabel}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="home-dashboard-card__meta home-dashboard-card__meta--accent">
                      {rosterCount} / {maxPlayers} players going
                    </p>
                  </div>
                </div>
                {canManageLeague(league.id) ? (
                  <div className="button-row home-card-actions">
                    <Link to={`/sessions/${session.id}`} className="w-full">
                      <PrimaryButton className="w-full home-btn-primary">
                        Open
                      </PrimaryButton>
                    </Link>
                    <SecondaryButton
                      type="button"
                      className="w-full home-btn-secondary"
                      onClick={() => setSessionToDelete(session)}
                    >
                      Delete
                    </SecondaryButton>
                  </div>
                ) : (
                  <Link
                    to={`/sessions/${session.id}`}
                    className="w-full league-session-card__solo-link"
                  >
                    <PrimaryButton className="w-full home-btn-primary">
                      Open Session
                    </PrimaryButton>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <LeagueSectionHead
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
            <circle cx="12" cy="8" r="3" />
          </svg>
        }
      >
        Members
      </LeagueSectionHead>

      <section className="card profile-panel-card league-members-panel">
        <div className="screen-stack league-members-grid">
          {!useApiMembers ? (
            <p className="meta home-empty-hint">
              Member roster loads from the database when this league is linked
              to your signed-in account.
            </p>
          ) : null}
          {useApiMembers && apiMembers === null ? (
            <p className="meta">Loading members…</p>
          ) : null}
          {displayMembers.map((member) => {
            const metricsTail = ` · OVR ${member.overall ?? "N/A"} · $${member.value.toFixed(1)}M · ${member.archetype || "None"} · ${formatLeagueRole(member.primaryRole)}${
              member.isCaptain ? " · Capt" : ""
            }`;
            return (
              <Link
                key={member.key}
                to={`/players/${member.profileId}?from=league`}
                className="league-member-mini-card league-member-mini-card--premium"
                title={`${member.name}${metricsTail}`}
                aria-label={`${member.name}${metricsTail}`}
              >
                <div className="avatar league-member-mini-card__avatar">
                  {member.avatarImage ? (
                    <img
                      src={member.avatarImage}
                      alt=""
                      className="hero-card-main__avatar-image"
                    />
                  ) : (
                    member.initials
                  )}
                </div>
                <div className="league-member-mini-card__body">
                  <span className="league-member-mini-card__name">
                    {member.name}
                  </span>
                  <span className="league-member-mini-card__metrics">
                    {metricsTail}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        className="card home-footer-card profile-footer-card league-footer-card"
        aria-label="Motivation"
      >
        <span className="home-footer-card__icon" aria-hidden="true">
          <LeagueShieldIcon />
        </span>
        <p className="home-footer-card__text">
          Strong leagues show up.{" "}
          <span className="home-footer-card__accent">
            Great nights start here.
          </span>
        </p>
      </section>
    </div>
  );
}

export default LeagueDetail;
