-- Safe migration: play style votes + league_members style counters (existing data preserved).
-- Run manually or via: node scripts/migrate-player-style-reviews.js

CREATE TABLE IF NOT EXISTS player_style_votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  session_id INT NOT NULL,
  reviewed_user_id INT NOT NULL,
  reviewer_user_id INT NOT NULL,
  submission_id INT NULL,
  style_key VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_style_vote_session (session_id, reviewer_user_id, reviewed_user_id, style_key),
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES player_stat_submissions(id) ON DELETE CASCADE
);

ALTER TABLE league_members ADD COLUMN style_positioning INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_fast INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_intelligent INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_sniper INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_strong INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_skilled INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_creative INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_defensive INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_clutch INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_leader INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_aggressive INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_stamina INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_passer INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN style_dribbler INT NOT NULL DEFAULT 0;
