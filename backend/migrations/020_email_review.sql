-- Card #242: the review list ("Átnézés"). The owner turns important emails into
-- GTD tasks, marks "want to know" emails as seen, and dismisses the rest.

-- "Want to know, nothing to do": set by a want_to_know rule, or by the LLM once
-- the prompt asks for it (NULL = not asked).
ALTER TABLE triage_results ADD COLUMN want_to_know INTEGER;

-- One decision per email; an email with a decision leaves the review lists.
CREATE TABLE IF NOT EXISTS email_review (
  email_id   TEXT PRIMARY KEY REFERENCES emails(id) ON DELETE CASCADE,
  list       TEXT NOT NULL,                 -- todo | know | unsure: where it was decided
  decision   TEXT NOT NULL CHECK (decision IN ('todo', 'dismissed', 'seen')),
  task_id    TEXT,                          -- Vikunja task for decision 'todo'
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);
