-- Generic settings table (reusable for future features)
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('triage_instructions', 'Flag emails where I need to reply, make a decision, meet a deadline, pick up a package, review a document, or take any concrete action. Ignore newsletters, automated notifications, marketing, and CI/build alerts.'),
  ('triage_enabled', 'true'),
  ('triage_learned_profile', '');

-- Triage results: one row per email
CREATE TABLE IF NOT EXISTS triage_results (
  email_id       TEXT PRIMARY KEY REFERENCES emails(id) ON DELETE CASCADE,
  score          INTEGER NOT NULL DEFAULT 0,
  action_type    TEXT NOT NULL DEFAULT 'none',
  reason         TEXT,
  suggested_task TEXT,
  model          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_triage_score ON triage_results(score DESC);

-- Triage feedback: user approve/dismiss/create_task decisions
CREATE TABLE IF NOT EXISTS triage_feedback (
  id             TEXT PRIMARY KEY,
  email_id       TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  decision       TEXT NOT NULL,
  triage_score   INTEGER,
  triage_action  TEXT,
  reason         TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON triage_feedback(created_at DESC);
