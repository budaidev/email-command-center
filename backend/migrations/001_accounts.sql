CREATE TABLE IF NOT EXISTS accounts (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  label      TEXT,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  imap_user  TEXT NOT NULL,
  imap_pass  TEXT NOT NULL,  -- AES-256-GCM encrypted
  last_uid   INTEGER DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
