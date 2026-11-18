-- Card #238 (2026-11-18): keep "not evaluated" apart from "not important",
-- and keep the mail's own date apart from the time it reached the mailserver.

ALTER TABLE triage_results ADD COLUMN status TEXT NOT NULL DEFAULT 'evaluated'; -- evaluated | not_evaluated
ALTER TABLE triage_results ADD COLUMN error TEXT;

-- ai_score is NOT NULL (012), so a not-evaluated row keeps ai_score 0; status is what tells it apart.

-- Rows written before this migration with no AI answer: the LLM call failed or
-- skipped the email, and the old code stored that as AI score 0.
UPDATE triage_results
   SET status = 'not_evaluated',
       error = 'No AI answer stored (before 2026-11-18; cause not recorded)'
 WHERE (reason IS NULL OR reason = '') AND COALESCE(ai_score, 0) = 0;

ALTER TABLE emails ADD COLUMN received_at TEXT; -- when the mailserver got it (IMAP INTERNALDATE)
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_triage_status ON triage_results(status);
