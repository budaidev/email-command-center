import { Router } from 'express';
import db from '../db.js';
import {
  syncAllCalendars,
  syncCalendarEvents,
  getEventsForDate,
  getEventsForRange,
  testCalDAVConnection,
} from '../services/caldav.js';

const router = Router();

// GET /api/calendar-events?date=YYYY-MM-DD
// GET /api/calendar-events?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', (req, res, next) => {
  try {
    const { date, from, to } = req.query;
    if (date) {
      res.json(getEventsForDate(date));
    } else if (from && to) {
      res.json(getEventsForRange(from, to));
    } else {
      res.status(400).json({ error: 'Provide date or from+to params' });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/calendar-events/sync — sync all configured accounts
router.post('/sync', async (req, res, next) => {
  try {
    await syncAllCalendars();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/calendar-events/sync/:accountId — sync one account
router.post('/sync/:accountId', async (req, res, next) => {
  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (!account.caldav_url) return res.status(400).json({ error: 'No CalDAV configured for this account' });
    const result = await syncCalendarEvents(account);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/calendar-events/test — test CalDAV connection
router.post('/test', async (req, res, next) => {
  try {
    const { url, username, password } = req.body;
    if (!url || !username || !password) {
      return res.status(400).json({ error: 'url, username, password required' });
    }
    const result = await testCalDAVConnection(url, username, password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/calendar-events/calendar/:yearMonth — event counts per day for a month
router.get('/calendar/:yearMonth', (req, res, next) => {
  try {
    const { yearMonth } = req.params;
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return res.status(400).json({ error: 'Invalid format. Use YYYY-MM.' });
    }
    const rows = db.prepare(`
      SELECT date(dtstart) AS day, COUNT(*) AS count
      FROM calendar_events
      WHERE strftime('%Y-%m', dtstart) = ?
      GROUP BY date(dtstart)
    `).all(yearMonth);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
