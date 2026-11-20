-- Card #246: deterministic signals per email, computed without an LLM when the
-- email is first prepared (headers, addresses, attachments, keywords).
CREATE TABLE IF NOT EXISTS email_signals (
  email_id    TEXT PRIMARY KEY REFERENCES emails(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,   -- signals.js SIGNALS_VERSION; older rows are recomputed
  signals     TEXT NOT NULL,      -- JSON, see services/signals.js
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
