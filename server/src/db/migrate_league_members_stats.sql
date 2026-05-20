-- Run once on existing databases (MySQL without ADD COLUMN IF NOT EXISTS).
-- Prefer: node scripts/migrate-league-members-stats.js

ALTER TABLE league_members ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE league_members ADD COLUMN matches_played INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN rating DECIMAL(3,1) NOT NULL DEFAULT 6.0;
ALTER TABLE league_members ADD COLUMN goals INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN wins INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN losses INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN mvp_count INT NOT NULL DEFAULT 0;
ALTER TABLE league_members ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

UPDATE league_members SET rating = 6.0 WHERE matches_played = 0;
