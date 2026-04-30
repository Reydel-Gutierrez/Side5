-- Testing-only seed data. password_hash is plain text "1234" for now.
-- TODO: replace with bcrypt-hashed passwords before production.
INSERT INTO users (username, password_hash, display_name, base_value, rating)
VALUES
  ('reydel', '1234', 'Reydel', 18.50, 8.9),
  ('alexis', '1234', 'Alexis', 14.20, 8.2),
  ('migue', '1234', 'Migue', 9.80, 7.6),
  ('jorge', '1234', 'Jorge', 8.10, 7.8),
  ('andres', '1234', 'Andres', 7.30, 7.4),
  ('nico', '1234', 'Nico', 6.80, 7.2),
  ('ivan', '1234', 'Ivan', 6.00, 7.0),
  ('pablo', '1234', 'Pablo', 5.50, 6.8),
  ('mario', '1234', 'Mario', 7.00, 7.1),
  ('rafa', '1234', 'Rafa', 7.50, 7.5),
  ('dani', '1234', 'Dani', 6.70, 7.0),
  ('leo', '1234', 'Leo', 8.20, 7.9),
  ('chris', '1234', 'Chris', 6.20, 6.9),
  ('juan', '1234', 'Juan', 5.90, 7.1),
  ('guti', '1234', 'Guti', 6.40, 7.0);

INSERT INTO leagues (name, description, invite_code, owner_user_id)
VALUES (
  'Monday Ballers',
  'Weekly Monday side5 league.',
  'SIDE5-MON',
  (SELECT id FROM users WHERE username = 'reydel')
);

INSERT INTO league_members (league_id, user_id, role)
VALUES (
  (SELECT id FROM leagues WHERE invite_code = 'SIDE5-MON'),
  (SELECT id FROM users WHERE username = 'reydel'),
  'owner'
);

INSERT INTO sessions (
  league_id,
  title,
  session_date,
  session_time,
  location,
  format,
  budget_per_team,
  status,
  created_by_user_id
)
VALUES (
  (SELECT id FROM leagues WHERE invite_code = 'SIDE5-MON'),
  'Monday Night',
  DATE_ADD(CURDATE(), INTERVAL 7 DAY),
  '20:00:00',
  'North Indoor Arena',
  '5v5',
  50.00,
  'open',
  (SELECT id FROM users WHERE username = 'reydel')
);

INSERT INTO teams (session_id, name, captain_user_id)
SELECT id, 'Side A', NULL FROM sessions WHERE title = 'Monday Night' LIMIT 1;

INSERT INTO teams (session_id, name, captain_user_id)
SELECT id, 'Side B', NULL FROM sessions WHERE title = 'Monday Night' LIMIT 1;
