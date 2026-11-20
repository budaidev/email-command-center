-- Card #246: points per signal (services/signalscore.js). One row: the current model.
CREATE TABLE IF NOT EXISTS signal_score_model (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  intercept     INTEGER NOT NULL,               -- points before any signal
  features      TEXT NOT NULL,                  -- JSON {key: {learned, override, share}}
  high          INTEGER NOT NULL DEFAULT 30,    -- score >= high: important
  low           INTEGER NOT NULL DEFAULT -30,   -- score <= low: not important, no LLM call
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | active | off
  training      TEXT,                           -- JSON {at, rows, positives, sources}
  last_backtest TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
