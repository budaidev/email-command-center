-- Card #247: decision rules over the deterministic signals, edited and backtested in
-- the UI (Triage > Workbench). The old additive scoring_rules stay but are unused.
CREATE TABLE IF NOT EXISTS decision_rules (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  conditions    TEXT NOT NULL DEFAULT '[]',     -- JSON [{field, op, value}], all must hold
  verdict       TEXT NOT NULL,                  -- not_important (no LLM call) | important (LLM still runs, verdict forced)
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | active | off
  note          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  last_backtest TEXT,                           -- JSON summary of the last backtest
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The owner's labels, copied from the Langfuse dataset ecc-importance-labels.
CREATE TABLE IF NOT EXISTS importance_labels (
  email_id     TEXT PRIMARY KEY,
  important    INTEGER NOT NULL,
  want_to_know INTEGER,
  labels       TEXT NOT NULL,   -- JSON: the dataset item's expectedOutput
  stratum      TEXT,
  synced_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sender domain categories for the domain_category signal (suffix match).
-- Only generic examples here: the owner's own list (banks, insurers, school, work...)
-- is kept in the database and edited in Triage > Workbench.
CREATE TABLE IF NOT EXISTS domain_categories (
  domain     TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO domain_categories (domain, category) VALUES
  ('gov.hu', 'government'),
  ('magyarorszag.hu', 'government'),
  ('nav.gov.hu', 'government'),
  ('tarsadalombiztositasilevelek.hu', 'government'),
  ('apache.org', 'work'),
  ('mifos.org', 'work');
