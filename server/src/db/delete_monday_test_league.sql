-- One-time cleanup: remove a league named "Monday test league" (case-insensitive) and all dependent rows.
-- Run against your MySQL database when that stray test league exists, e.g.:
--   mysql -u ... -p your_db < server/src/db/delete_monday_test_league.sql

SET @tid := (
  SELECT id FROM leagues WHERE LOWER(TRIM(name)) = 'monday test league' ORDER BY id LIMIT 1
);

DELETE ss FROM stat_submissions ss
INNER JOIN matches m ON m.id = ss.match_id
INNER JOIN sessions s ON s.id = m.session_id
WHERE @tid IS NOT NULL AND s.league_id = @tid;

DELETE ss FROM stat_submissions ss
INNER JOIN sessions s ON s.id = ss.session_id
WHERE @tid IS NOT NULL AND s.league_id = @tid;

DELETE FROM stat_submissions WHERE @tid IS NOT NULL AND league_id = @tid;

DELETE m FROM matches m
INNER JOIN sessions s ON s.id = m.session_id
WHERE @tid IS NOT NULL AND s.league_id = @tid;

DELETE tp FROM team_players tp
INNER JOIN teams t ON t.id = tp.team_id
INNER JOIN sessions s ON s.id = t.session_id
WHERE @tid IS NOT NULL AND s.league_id = @tid;

DELETE t FROM teams t
INNER JOIN sessions s ON s.id = t.session_id
WHERE @tid IS NOT NULL AND s.league_id = @tid;

DELETE sp FROM session_players sp
INNER JOIN sessions s ON s.id = sp.session_id
WHERE @tid IS NOT NULL AND s.league_id = @tid;

DELETE FROM sessions WHERE @tid IS NOT NULL AND league_id = @tid;

DELETE FROM league_members WHERE @tid IS NOT NULL AND league_id = @tid;

DELETE FROM leagues WHERE @tid IS NOT NULL AND id = @tid;
