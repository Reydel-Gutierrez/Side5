-- Testing-only seed data.
-- password_hash is plain text "1234" for now.
-- TODO: replace with bcrypt-hashed passwords before production.

USE side5_db;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

DELETE FROM session_mvp_votes;
DELETE FROM player_stat_review_slots;
DELETE FROM player_stat_reviews;
DELETE FROM player_stat_submissions;
DELETE FROM stat_submissions;
DELETE FROM matches;
DELETE FROM team_players;
DELETE FROM teams;
DELETE FROM session_players;
DELETE FROM sessions;
DELETE FROM league_members;
DELETE FROM player_profiles;
DELETE FROM leagues;
DELETE FROM users;

SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE leagues AUTO_INCREMENT = 1;
ALTER TABLE league_members AUTO_INCREMENT = 1;

INSERT INTO users (username, password_hash, display_name, base_value, rating)
VALUES
  ('reydel_demo', '1234', 'Reydel Gutierrez', 10.00, 6.0),
  ('alexis_demo', '1234', 'Alexis Rodriguez', 10.00, 6.0),
  ('migue_demo', '1234', 'Miguel Perez', 10.00, 6.0),
  ('jorge_demo', '1234', 'Jorge Hernandez', 10.00, 6.0);

INSERT INTO player_profiles (user_id, main_archetype, total_worth, ovr, mvp_trophies, matches_played)
SELECT id, 'None', 10.00, 60, 0, 0
FROM users;

INSERT INTO leagues (name, description, invite_code, owner_user_id)
VALUES (
  'Demo League',
  'Testing league for the Side5 demo environment.',
  'SIDE5-DEMO',
  (SELECT id FROM users WHERE username = 'reydel_demo')
);

INSERT INTO league_members (
  league_id,
  user_id,
  role,
  is_active,
  matches_played,
  rating,
  goals,
  wins,
  losses,
  mvp_count,
  ovr,
  player_worth
)
SELECT
  (SELECT id FROM leagues WHERE invite_code = 'SIDE5-DEMO'),
  u.id,
  CASE WHEN u.username = 'reydel_demo' THEN 'owner' ELSE 'player' END,
  TRUE,
  0,
  6.0,
  0,
  0,
  0,
  0,
  60,
  10.00
FROM users u
WHERE u.username IN (
  'reydel_demo',
  'alexis_demo',
  'migue_demo',
  'jorge_demo'
);