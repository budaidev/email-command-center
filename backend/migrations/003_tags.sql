CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_tags (
  email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (email_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_email_tags_email ON email_tags(email_id);
CREATE INDEX IF NOT EXISTS idx_email_tags_tag   ON email_tags(tag_id);
