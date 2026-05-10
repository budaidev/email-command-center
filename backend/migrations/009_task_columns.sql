-- GTD column mapping for Vikunja tasks.
-- Stores which kanban column each task belongs to locally,
-- since the Vikunja API token may not have label permissions.
CREATE TABLE IF NOT EXISTS task_columns (
  vikunja_task_id  INTEGER PRIMARY KEY,
  gtd_column       TEXT NOT NULL DEFAULT 'inbox',
  context          TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_columns_col ON task_columns(gtd_column);
