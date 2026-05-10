CREATE TABLE IF NOT EXISTS category_actions (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  label       TEXT,
  config      TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_category_actions_category ON category_actions(category_id);

-- Log of action executions
CREATE TABLE IF NOT EXISTS action_log (
  id          TEXT PRIMARY KEY,
  action_id   TEXT NOT NULL REFERENCES category_actions(id) ON DELETE CASCADE,
  email_id    TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'success',
  output      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_action_log_email ON action_log(email_id);
