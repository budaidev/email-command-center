-- The owner's correction of an email's verdict ("Rossz besorolás"), from the review
-- list or the reading view. One row per email, the latest wins. The prediction at
-- the time is kept with it, so mismatches can be measured per prompt version.
CREATE TABLE IF NOT EXISTS email_feedback (
  email_id       TEXT PRIMARY KEY REFERENCES emails(id) ON DELETE CASCADE,
  verdict        TEXT NOT NULL CHECK (verdict IN ('important', 'want_to_know', 'not_important')),
  note           TEXT,
  predicted      TEXT,            -- important | want_to_know | not_important | NULL (not evaluated)
  prompt_version TEXT,
  model          TEXT,
  source         TEXT,            -- review:<list> | reading
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
