-- ============================================================
-- MISS DUMALINAO 2026 - Pageant Tabulation System
-- MySQL Schema (normalized) - run: mysql -u root -p < schema.sql
-- ============================================================
DROP DATABASE IF EXISTS miss_dumalinao_2026;
CREATE DATABASE miss_dumalinao_2026 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE miss_dumalinao_2026;

CREATE TABLE roles (
  role_id     TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  role_name   VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id       INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  full_name     VARCHAR(100) NOT NULL,
  role_id       TINYINT UNSIGNED NOT NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
  INDEX idx_users_role (role_id)
) ENGINE=InnoDB;

CREATE TABLE judges (
  judge_id   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL UNIQUE,
  status     ENUM('active','inactive') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_judges_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE candidates (
  candidate_id     INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  candidate_number INT UNSIGNED NOT NULL UNIQUE,
  candidate_name   VARCHAR(100) NOT NULL,
  municipality     VARCHAR(100) NOT NULL,
  age              TINYINT UNSIGNED NOT NULL,
  photo            VARCHAR(255) NULL,
  is_top5          TINYINT(1) NOT NULL DEFAULT 0,
  is_top3          TINYINT(1) NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_age CHECK (age BETWEEN 15 AND 40)
) ENGINE=InnoDB;

-- A "round" is a stage of the pageant
CREATE TABLE rounds (
  round_id   TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  round_code ENUM('PRELIM','TOP5','FINAL') NOT NULL UNIQUE,
  round_name VARCHAR(60) NOT NULL,
  sequence   TINYINT UNSIGNED NOT NULL,
  status     ENUM('pending','active','locked','archived') NOT NULL DEFAULT 'pending'
) ENGINE=InnoDB;

-- Categories belong to a round; weight is % within the round
CREATE TABLE categories (
  category_id   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  round_id      TINYINT UNSIGNED NOT NULL,
  category_name VARCHAR(80) NOT NULL,
  weight        DECIMAL(5,2) NOT NULL,
  sequence      TINYINT UNSIGNED NOT NULL,
  status        ENUM('pending','active','locked') NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_categories_round FOREIGN KEY (round_id) REFERENCES rounds(round_id),
  CONSTRAINT chk_cat_weight CHECK (weight > 0 AND weight <= 100),
  INDEX idx_categories_round (round_id)
) ENGINE=InnoDB;

-- Criteria belong to a category; weight is % within the category
CREATE TABLE criteria (
  criterion_id   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  category_id    INT UNSIGNED NOT NULL,
  criterion_name VARCHAR(120) NOT NULL,
  weight         DECIMAL(5,2) NOT NULL,
  sequence       TINYINT UNSIGNED NOT NULL,
  CONSTRAINT fk_criteria_category FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE,
  CONSTRAINT chk_crit_weight CHECK (weight > 0 AND weight <= 100),
  INDEX idx_criteria_category (category_id)
) ENGINE=InnoDB;

-- One score row per (judge, candidate, category)
CREATE TABLE scores (
  score_id     INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  judge_id     INT UNSIGNED NOT NULL,
  candidate_id INT UNSIGNED NOT NULL,
  category_id  INT UNSIGNED NOT NULL,
  total        DECIMAL(7,3) NOT NULL DEFAULT 0,
  status       ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
  archived     TINYINT(1) NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scores_judge     FOREIGN KEY (judge_id)     REFERENCES judges(judge_id),
  CONSTRAINT fk_scores_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  CONSTRAINT fk_scores_category  FOREIGN KEY (category_id)  REFERENCES categories(category_id),
  UNIQUE KEY uq_score (judge_id, candidate_id, category_id),
  INDEX idx_scores_category (category_id),
  INDEX idx_scores_candidate (candidate_id)
) ENGINE=InnoDB;

CREATE TABLE score_details (
  score_detail_id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  score_id        INT UNSIGNED NOT NULL,
  criterion_id    INT UNSIGNED NOT NULL,
  value           DECIMAL(5,2) NOT NULL,
  CONSTRAINT fk_sd_score     FOREIGN KEY (score_id)     REFERENCES scores(score_id) ON DELETE CASCADE,
  CONSTRAINT fk_sd_criterion FOREIGN KEY (criterion_id) REFERENCES criteria(criterion_id),
  CONSTRAINT chk_value CHECK (value >= 1 AND value <= 100),
  UNIQUE KEY uq_detail (score_id, criterion_id)
) ENGINE=InnoDB;

-- Ranking history (Top 5 / Top 3 / Final generations)
CREATE TABLE rankings (
  ranking_id   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  stage        ENUM('PRELIM','TOP5','TOP3','FINAL') NOT NULL,
  candidate_id INT UNSIGNED NOT NULL,
  rank_no      TINYINT UNSIGNED NOT NULL,
  score        DECIMAL(7,3) NOT NULL,
  generated_by INT UNSIGNED NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  batch_id     VARCHAR(36) NOT NULL,
  CONSTRAINT fk_rank_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  CONSTRAINT fk_rank_user      FOREIGN KEY (generated_by) REFERENCES users(user_id),
  INDEX idx_rankings_stage (stage, batch_id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  log_id     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id    INT UNSIGNED NULL,
  action     VARCHAR(60) NOT NULL,
  details    VARCHAR(500) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE settings (
  setting_key   VARCHAR(60) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO roles (role_name) VALUES ('admin'), ('judge'), ('tabulator'), ('display');

INSERT INTO rounds (round_code, round_name, sequence, status) VALUES
  ('PRELIM', 'Preliminary Round', 1, 'pending'),
  ('TOP5',   'Top 5 Question & Answer', 2, 'pending'),
  ('FINAL',  'Final Round', 3, 'pending');

-- Preliminary categories
INSERT INTO categories (round_id, category_name, weight, sequence) VALUES
  (1, 'National Costume', 25.00, 1),
  (1, 'Advocacy Speech', 15.00, 2),
  (1, 'Production Number', 15.00, 3),
  (1, 'Swimsuit', 20.00, 4),
  (1, 'Evening Gown', 25.00, 5),
  (2, 'Top 5 Question & Answer', 100.00, 1),
  (3, 'Final Question & Answer', 100.00, 1);

-- National Costume (cat 1)
INSERT INTO criteria (category_id, criterion_name, weight, sequence) VALUES
  (1, 'Creativity and Originality', 30.00, 1),
  (1, 'Cultural Significance and Representation', 30.00, 2),
  (1, 'Craftsmanship and Design', 20.00, 3),
  (1, 'Poise, Stage Presentation and Beauty', 20.00, 4),
-- Advocacy Speech (cat 2)
  (2, 'Content and Relevance of Advocacy', 35.00, 1),
  (2, 'Delivery and Communication Skills', 25.00, 2),
  (2, 'Confidence and Stage Presence', 20.00, 3),
  (2, 'Impact and Persuasiveness', 20.00, 4),
-- Production Number (cat 3)
  (3, 'Performance, Execution, and Energy', 40.00, 1),
  (3, 'Stage Presence and Beauty', 30.00, 2),
  (3, 'Confidence and Personality', 30.00, 3),
-- Swimsuit (cat 4)
  (4, 'Physical Fitness, Body Bearing, and Beauty of Physique', 35.00, 1),
  (4, 'Confidence and Poise', 25.00, 2),
  (4, 'Stage Presence and Beauty Appeal', 20.00, 3),
  (4, 'Overall Impact and Impression', 20.00, 4),
-- Evening Gown (cat 5)
  (5, 'Elegance, Grace, and Beauty of Gown Presentation', 35.00, 1),
  (5, 'Poise, Confidence, and Beauty of Presence', 30.00, 2),
  (5, 'Stage Presence and Overall Beauty Impact', 20.00, 3),
  (5, 'Overall Appearance and Beauty Impression', 15.00, 4),
-- Top 5 Q&A (cat 6)
  (6, 'Content and Substance', 40.00, 1),
  (6, 'Communication Skills and Delivery', 25.00, 2),
  (6, 'Poise, Confidence and Stage Presence', 20.00, 3),
  (6, 'Beauty and Personality Impact', 15.00, 4),
-- Final Q&A (cat 7)
  (7, 'Content, Relevance and Depth of Answer', 45.00, 1),
  (7, 'Communication Skills and Delivery', 25.00, 2),
  (7, 'Poise, Confidence and Stage Presence', 15.00, 3),
  (7, 'Beauty, Personality and Overall Impact', 15.00, 4);

INSERT INTO settings (setting_key, setting_value) VALUES
  ('display_phase', 'candidates'),   -- candidates | top5 | top3 | winner
  ('event_name', 'Miss Dumalinao 2026'),
  ('event_date', '2026-06-15');
