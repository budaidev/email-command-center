-- Add missing index on triage_feedback.email_id for JOIN/GROUP BY performance
CREATE INDEX IF NOT EXISTS idx_triage_feedback_email ON triage_feedback(email_id);
