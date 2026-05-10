-- Optional CalDAV credentials on accounts
ALTER TABLE accounts ADD COLUMN caldav_url TEXT;
ALTER TABLE accounts ADD COLUMN caldav_user TEXT;
ALTER TABLE accounts ADD COLUMN caldav_pass TEXT;

-- Calendar events synced from CalDAV
CREATE TABLE IF NOT EXISTS calendar_events (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  uid          TEXT NOT NULL,
  calendar_uri TEXT,
  summary      TEXT,
  description  TEXT,
  location     TEXT,
  dtstart      TEXT NOT NULL,
  dtend        TEXT,
  all_day      INTEGER NOT NULL DEFAULT 0,
  recurrence   TEXT,
  status       TEXT,
  organizer    TEXT,
  attendees    TEXT DEFAULT '[]',
  raw_ics      TEXT,
  synced_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(dtstart);
CREATE INDEX IF NOT EXISTS idx_calendar_events_account ON calendar_events(account_id);
