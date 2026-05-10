-- Enrichment results: one JSON blob per email, updated by pipeline
CREATE TABLE IF NOT EXISTS email_enrichments (
  email_id         TEXT PRIMARY KEY REFERENCES emails(id) ON DELETE CASCADE,
  data             TEXT NOT NULL DEFAULT '{}',
  steps_run        TEXT NOT NULL DEFAULT '[]',
  pipeline_version INTEGER NOT NULL DEFAULT 1,
  started_at       TEXT,
  completed_at     TEXT,
  error            TEXT
);

-- Pipeline step registry: which enrichers are enabled and in what order
CREATE TABLE IF NOT EXISTS pipeline_steps (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL DEFAULT 'enricher',
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  config      TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default pipeline steps
INSERT OR IGNORE INTO pipeline_steps (id, name, type, sort_order, config) VALUES
  ('step-categorize',  'categorize',  'enricher', 10, '{}'),
  ('step-summary',     'summary',     'enricher', 20, '{"max_chars":500,"skip_if_no_body":true}'),
  ('step-references',  'references',  'enricher', 30, '{}'),
  ('step-auto-tag',    'auto_tag',    'enricher', 40, '{}'),
  ('step-score',       'score',       'scorer',   50, '{}'),
  ('step-actions',     'actions',     'action',   60, '{}');
