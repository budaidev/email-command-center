-- Scoring rules: static point-based rules that combine with AI scores
CREATE TABLE IF NOT EXISTS scoring_rules (
  id          TEXT PRIMARY KEY,
  field       TEXT NOT NULL,       -- sender_email, sender_domain, sender_name, subject, category, keyword, recipient_email, recipient_domain
  operator    TEXT NOT NULL,       -- contains, equals, starts_with, ends_with
  value       TEXT NOT NULL,
  score       INTEGER NOT NULL,    -- -50 to +50: positive = boost, negative = suppress
  action_type TEXT DEFAULT NULL,   -- optional override: reply, review, decide, schedule, pickup, send, delegate, task
  label       TEXT DEFAULT '',     -- human description
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add score breakdown columns to triage_results
ALTER TABLE triage_results ADD COLUMN rule_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE triage_results ADD COLUMN ai_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE triage_results ADD COLUMN matched_rules TEXT DEFAULT '[]';
