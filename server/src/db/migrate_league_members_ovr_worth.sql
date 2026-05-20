-- Prefer: node server/scripts/migrate-league-members-ovr-worth.js

ALTER TABLE league_members ADD COLUMN ovr SMALLINT NOT NULL DEFAULT 60;
ALTER TABLE league_members ADD COLUMN player_worth DECIMAL(6,2) NOT NULL DEFAULT 10.00;

UPDATE league_members lm
INNER JOIN users u ON u.id = lm.user_id
SET lm.player_worth = COALESCE(u.base_value, 10.00),
    lm.ovr = ROUND(COALESCE(lm.rating, u.rating, 6.0) * 10);
