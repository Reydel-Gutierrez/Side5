-- Past sessions: status value and finalized stats (idempotent with game hub migration)

ALTER TABLE sessions
  MODIFY COLUMN status ENUM('open', 'draft_pending', 'drafting', 'locked', 'completed', 'past') DEFAULT 'open';
