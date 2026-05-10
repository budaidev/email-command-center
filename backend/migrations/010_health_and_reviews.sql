-- GTD health snapshots for score history and weekly review tracking
CREATE TABLE IF NOT EXISTS gtd_health_snapshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  score      INTEGER NOT NULL,
  counts     TEXT    NOT NULL,          -- JSON: { inbox, next, wait, some, overdue, stale }
  warnings   TEXT    NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_date ON gtd_health_snapshots(created_at);

-- Index for linking emails to tasks (column already exists from migration 002)
CREATE INDEX IF NOT EXISTS idx_emails_gtd_task ON emails(gtd_task_id) WHERE gtd_task_id IS NOT NULL;
