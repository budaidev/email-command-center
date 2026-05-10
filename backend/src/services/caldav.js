import { createDAVClient } from 'tsdav';
import ical from 'node-ical';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { decrypt } from '../utils/crypto.js';

/**
 * Create a CalDAV client for an account.
 */
async function getClient(account) {
  const url = account.caldav_url;
  const username = account.caldav_user;
  const password = decrypt(account.caldav_pass);

  const client = await createDAVClient({
    serverUrl: url,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  return client;
}

/**
 * Test CalDAV connection with plaintext password.
 */
export async function testCalDAVConnection(url, username, password) {
  const client = await createDAVClient({
    serverUrl: url,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  const calendars = await client.fetchCalendars();
  return { ok: true, calendarCount: calendars.length };
}

/**
 * Sync all calendar events for an account.
 * Fetches events from 1 year ago to 6 months ahead.
 */
export async function syncCalendarEvents(account) {
  if (!account.caldav_url || !account.caldav_pass) return { synced: 0 };

  console.log(`[CalDAV] Syncing calendars for ${account.email}...`);
  const client = await getClient(account);

  const calendars = await client.fetchCalendars();
  let totalSynced = 0;

  const now = new Date();
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);
  const to = new Date(now);
  to.setMonth(to.getMonth() + 6);

  const timeRange = {
    start: from.toISOString(),
    end: to.toISOString(),
  };

  for (const calendar of calendars) {
    try {
      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange,
      });

      const upsert = db.prepare(`
        INSERT INTO calendar_events (id, account_id, uid, calendar_uri, summary, description,
          location, dtstart, dtend, all_day, recurrence, status, organizer, attendees, raw_ics, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(account_id, uid) DO UPDATE SET
          summary = excluded.summary, description = excluded.description,
          location = excluded.location, dtstart = excluded.dtstart, dtend = excluded.dtend,
          all_day = excluded.all_day, recurrence = excluded.recurrence, status = excluded.status,
          organizer = excluded.organizer, attendees = excluded.attendees,
          raw_ics = excluded.raw_ics, synced_at = datetime('now')
      `);

      const transaction = db.transaction(() => {
        for (const obj of objects) {
          const icsData = obj.data;
          if (!icsData) continue;

          const parsed = ical.sync.parseICS(icsData);
          for (const key of Object.keys(parsed)) {
            const event = parsed[key];
            if (event.type !== 'VEVENT') continue;

            const uid = event.uid || key;
            const summary = event.summary || '';
            const description = event.description || '';
            const location = event.location || '';

            // Handle dates
            const start = event.start;
            const end = event.end;
            const allDay = start && !start.getHours && typeof start === 'object' && start.dateOnly ? 1
              : (event.datetype === 'date' ? 1 : 0);

            const dtstart = start ? (start instanceof Date ? start.toISOString() : String(start)) : '';
            const dtend = end ? (end instanceof Date ? end.toISOString() : String(end)) : null;

            const recurrence = event.rrule ? event.rrule.toString() : null;
            const status = event.status || null;
            const organizer = event.organizer
              ? (typeof event.organizer === 'object' ? (event.organizer.val || '').replace('mailto:', '') : String(event.organizer).replace('mailto:', ''))
              : null;

            let attendees = '[]';
            if (event.attendee) {
              const arr = Array.isArray(event.attendee) ? event.attendee : [event.attendee];
              attendees = JSON.stringify(arr.map(a => {
                if (typeof a === 'object') {
                  return { email: (a.val || '').replace('mailto:', ''), name: a.params?.CN || '', status: a.params?.PARTSTAT || '' };
                }
                return { email: String(a).replace('mailto:', ''), name: '', status: '' };
              }));
            }

            upsert.run(uuidv4(), account.id, uid, calendar.url, summary, description,
              location, dtstart, dtend, allDay, recurrence, status, organizer, attendees, icsData);
            totalSynced++;
          }
        }
      });
      transaction();
    } catch (err) {
      console.error(`[CalDAV] Error syncing calendar ${calendar.displayName || calendar.url}:`, err.message);
    }
  }

  console.log(`[CalDAV] Synced ${totalSynced} events for ${account.email}`);
  return { synced: totalSynced };
}

/**
 * Sync all accounts that have CalDAV configured.
 */
export async function syncAllCalendars() {
  const accounts = db.prepare(
    'SELECT * FROM accounts WHERE is_active = 1 AND caldav_url IS NOT NULL AND caldav_pass IS NOT NULL'
  ).all();

  for (const account of accounts) {
    await syncCalendarEvents(account).catch(err =>
      console.error(`[CalDAV] Failed to sync ${account.email}:`, err.message)
    );
  }
}

/**
 * Get events for a specific date.
 */
export function getEventsForDate(date) {
  return db.prepare(`
    SELECT ce.*, a.email AS account_email, a.label AS account_label, a.color AS account_color
    FROM calendar_events ce
    JOIN accounts a ON ce.account_id = a.id
    WHERE date(ce.dtstart) = ? OR (ce.dtend IS NOT NULL AND date(ce.dtstart) <= ? AND date(ce.dtend) >= ?)
    ORDER BY ce.dtstart
  `).all(date, date, date);
}

/**
 * Get events for a date range.
 */
export function getEventsForRange(from, to) {
  return db.prepare(`
    SELECT ce.*, a.email AS account_email, a.label AS account_label, a.color AS account_color
    FROM calendar_events ce
    JOIN accounts a ON ce.account_id = a.id
    WHERE date(ce.dtstart) >= ? AND date(ce.dtstart) <= ?
    ORDER BY ce.dtstart
  `).all(from, to);
}
