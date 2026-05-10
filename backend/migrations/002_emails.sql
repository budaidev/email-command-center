CREATE TABLE IF NOT EXISTS emails (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  uid          INTEGER NOT NULL,
  message_id   TEXT,
  thread_id    TEXT,
  subject      TEXT,
  sender_name  TEXT,
  sender_email TEXT NOT NULL,
  recipients   TEXT NOT NULL DEFAULT '[]',  -- JSON array
  snippet      TEXT,
  body_text    TEXT,
  body_html    TEXT,
  date         TEXT NOT NULL,               -- ISO8601
  is_read      INTEGER NOT NULL DEFAULT 0,
  labels       TEXT NOT NULL DEFAULT '[]',  -- JSON array of IMAP flags/labels
  paperless_id INTEGER,
  gtd_task_id  INTEGER,
  synced_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_emails_date       ON emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_account    ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_read       ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_paperless  ON emails(paperless_id);

CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
  subject,
  sender_name,
  sender_email,
  body_text,
  content=emails,
  content_rowid=rowid
);

-- Keep FTS in sync
CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
  INSERT INTO emails_fts(rowid, subject, sender_name, sender_email, body_text)
  VALUES (new.rowid, new.subject, new.sender_name, new.sender_email, new.body_text);
END;

CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, sender_name, sender_email, body_text)
  VALUES ('delete', old.rowid, old.subject, old.sender_name, old.sender_email, old.body_text);
END;

CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, sender_name, sender_email, body_text)
  VALUES ('delete', old.rowid, old.subject, old.sender_name, old.sender_email, old.body_text);
  INSERT INTO emails_fts(rowid, subject, sender_name, sender_email, body_text)
  VALUES (new.rowid, new.subject, new.sender_name, new.sender_email, new.body_text);
END;
