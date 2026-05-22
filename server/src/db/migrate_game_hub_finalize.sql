-- Game Hub post-match approval: ratings, MVP votes, manager finalization

CREATE TABLE IF NOT EXISTS session_mvp_votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  league_id INT NOT NULL,
  voter_user_id INT NOT NULL,
  voted_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_voter (session_id, voter_user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (voter_user_id) REFERENCES users(id),
  FOREIGN KEY (voted_user_id) REFERENCES users(id)
);

ALTER TABLE player_stat_submissions
  ADD COLUMN applied_to_league_members BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN approved_rating DECIMAL(3,1) NULL;

ALTER TABLE player_stat_reviews
  ADD COLUMN rating_label VARCHAR(16) NULL,
  ADD COLUMN rating_value DECIMAL(3,1) NULL;

ALTER TABLE sessions
  ADD COLUMN stats_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN stats_finalized_at DATETIME NULL,
  ADD COLUMN stats_finalized_by INT NULL;
