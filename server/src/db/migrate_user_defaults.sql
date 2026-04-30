-- Align database schema + defaults with backend expectations.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_image MEDIUMTEXT NULL,
  MODIFY COLUMN base_value DECIMAL(6,2) DEFAULT 10.00,
  MODIFY COLUMN rating DECIMAL(3,1) DEFAULT 6.0;

-- Normalize legacy records that were seeded with old defaults.
UPDATE users
SET base_value = 10.00
WHERE base_value IS NULL OR base_value = 5.00;

UPDATE users
SET rating = 6.0
WHERE rating IS NULL OR rating = 7.0;

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id INT PRIMARY KEY,
  main_archetype VARCHAR(50) DEFAULT 'None',
  total_worth DECIMAL(6,2) DEFAULT 10.00,
  ovr SMALLINT DEFAULT 60,
  mvp_trophies INT DEFAULT 0,
  matches_played INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO player_profiles (user_id, total_worth, ovr, main_archetype, mvp_trophies, matches_played)
SELECT
  u.id,
  CASE WHEN COALESCE(stats.approved_games, 0) = 0 THEN 10.00 ELSE COALESCE(u.base_value, 10.00) END AS total_worth,
  CASE WHEN COALESCE(stats.approved_games, 0) = 0 THEN 60 ELSE ROUND(COALESCE(u.rating, 6.0) * 10) END AS ovr,
  'None' AS main_archetype,
  COALESCE(stats.mvp_trophies, 0) AS mvp_trophies,
  COALESCE(stats.approved_games, 0) AS matches_played
FROM users u
LEFT JOIN (
  SELECT
    user_id,
    COUNT(DISTINCT match_id) AS approved_games,
    SUM(CASE WHEN is_mvp = 1 THEN 1 ELSE 0 END) AS mvp_trophies
  FROM stat_submissions
  WHERE status = 'approved'
  GROUP BY user_id
) stats ON stats.user_id = u.id
ON DUPLICATE KEY UPDATE
  total_worth = VALUES(total_worth),
  ovr = VALUES(ovr),
  mvp_trophies = VALUES(mvp_trophies),
  matches_played = VALUES(matches_played);