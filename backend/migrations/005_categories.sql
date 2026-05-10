CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  behavior   TEXT NOT NULL DEFAULT 'digest-only', -- always-summarize | digest-only | silent
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS category_rules (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  field       TEXT NOT NULL,    -- sender_email | sender_domain | sender_name | subject
  operator    TEXT NOT NULL,    -- contains | equals | starts_with | ends_with
  value       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_category_rules_cat ON category_rules(category_id);

ALTER TABLE emails ADD COLUMN category_id TEXT;
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category_id);
