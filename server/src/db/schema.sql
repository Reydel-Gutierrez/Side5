CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_image MEDIUMTEXT NULL,
  base_value DECIMAL(6,2) DEFAULT 10.00,
  rating DECIMAL(3,1) DEFAULT 6.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS leagues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  invite_code VARCHAR(30) UNIQUE NOT NULL,
  owner_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS league_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'manager', 'player') DEFAULT 'player',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (league_id, user_id),
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  location VARCHAR(100),
  format VARCHAR(20) DEFAULT '5v5',
  budget_per_team DECIMAL(6,2) DEFAULT 50.00,
  bench_shuffle_done TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('open', 'draft_pending', 'drafting', 'locked', 'completed') DEFAULT 'open',
  created_by_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS session_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('invited', 'confirmed', 'declined') DEFAULT 'invited',
  confirmed_at TIMESTAMP NULL,
  UNIQUE (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  captain_user_id INT NULL,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  budget_used DECIMAL(6,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (captain_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS team_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  pick_source VARCHAR(32) NOT NULL DEFAULT 'captain',
  UNIQUE (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  team_a_id INT NOT NULL,
  team_b_id INT NOT NULL,
  team_a_score INT DEFAULT 0,
  team_b_score INT DEFAULT 0,
  status ENUM('scheduled', 'completed') DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (team_a_id) REFERENCES teams(id),
  FOREIGN KEY (team_b_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS stat_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  session_id INT NOT NULL,
  league_id INT NOT NULL,
  user_id INT NOT NULL,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  saves INT DEFAULT 0,
  is_mvp BOOLEAN DEFAULT false,
  notes TEXT,
  status ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
  reviewed_by_user_id INT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
);
