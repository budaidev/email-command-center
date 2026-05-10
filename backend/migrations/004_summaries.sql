CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,        -- 'email' | 'day' | 'week'
  scope_key TEXT NOT NULL,   -- email_id | '2026-03-20' | '2026-W12'
  content TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, scope_key)
);

CREATE TABLE IF NOT EXISTS email_refs (
  id TEXT PRIMARY KEY,
  summary_id TEXT NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  email_id TEXT REFERENCES emails(id) ON DELETE CASCADE,
  type TEXT NOT NULL,        -- 'action' | 'date' | 'contact' | 'amount' | 'link'
  content TEXT NOT NULL,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
