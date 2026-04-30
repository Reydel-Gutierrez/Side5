-- MySQL / MariaDB (Workbench): add every user to "UEFA Night Session" as invited,
-- except Reydel Gutierrez (by display_name, case-insensitive), and skip anyone already on the roster.
--
-- 1) Optional: confirm the session row (adjust title in the INSERT if yours differs).
-- SELECT id, title, league_id, session_date FROM sessions WHERE title LIKE '%UEFA%';

INSERT INTO session_players (session_id, user_id, status, confirmed_at)
SELECT s.id,
       u.id,
       'invited',
       NULL
FROM users u
INNER JOIN (
  SELECT id
  FROM sessions
  WHERE TRIM(title) = 'UEFA Night Session'
  ORDER BY id DESC
  LIMIT 1
) AS s ON TRUE
WHERE LOWER(TRIM(u.display_name)) <> 'reydel gutierrez'
  AND NOT EXISTS (
    SELECT 1
    FROM session_players sp
    WHERE sp.session_id = s.id
      AND sp.user_id = u.id
  );

-- If your session title is different, change the WHERE inside the subquery, e.g.:
-- WHERE title = 'UEFA Night Session' COLLATE utf8mb4_general_ci
