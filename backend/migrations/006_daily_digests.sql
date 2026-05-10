CREATE TABLE IF NOT EXISTS daily_digests (
  id           TEXT PRIMARY KEY,
  date         TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'pending',
  headline     TEXT,
  content      TEXT,
  email_count  INTEGER NOT NULL DEFAULT 0,
  model        TEXT,
  error_msg    TEXT,
  generated_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_daily_digests_date ON daily_digests(date);
