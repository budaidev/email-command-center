-- Card #239: the AI part of triage is a yes/no rubric (prompts/importance.js).
ALTER TABLE triage_results ADD COLUMN important INTEGER;      -- 1/0; NULL = not evaluated or the old 0-50 score
ALTER TABLE triage_results ADD COLUMN criteria TEXT;          -- JSON: {reply_or_decision|mandatory_appointment|payment_due: {answer, evidence, evidence_found}, kind}
ALTER TABLE triage_results ADD COLUMN prompt_version TEXT;    -- "ecc-importance v1", or "ecc-importance local" when Langfuse was unreachable
CREATE INDEX IF NOT EXISTS idx_triage_prompt_version ON triage_results(prompt_version);
