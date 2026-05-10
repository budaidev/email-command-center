import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { getJSON, getModel } from './llm.js';
import { SYSTEM, buildUserMessage } from '../prompts/summarize-daily-digest.js';
import { getEventsForDate } from './caldav.js';

// Backfill state (module-level)
let backfillState = { running: false, total: 0, completed: 0, current_date: null, errors: [] };

/**
 * Get emails for a specific date, grouped by category.
 */
export function getDayEmailsByCategory(date) {
  const emails = db.prepare(`
    SELECT e.id, e.subject, e.sender_name, e.sender_email, e.date, e.is_read, e.snippet, e.category_id,
           c.name AS category_name, c.color AS category_color
    FROM emails e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE date(e.date) = ?
    ORDER BY e.date DESC
  `).all(date);

  const catMap = {};
  const uncategorized = { category_id: null, name: 'Uncategorized', color: '#4b5563', emails: [] };

  for (const e of emails) {
    if (e.category_id) {
      if (!catMap[e.category_id]) {
        catMap[e.category_id] = {
          category_id: e.category_id,
          name: e.category_name,
          color: e.category_color,
          emails: [],
        };
      }
      catMap[e.category_id].emails.push(e);
    } else {
      uncategorized.emails.push(e);
    }
  }

  const groups = Object.values(catMap);
  if (uncategorized.emails.length > 0) {
    groups.push(uncategorized);
  }

  return { emails, groups };
}

/**
 * Generate a daily digest for a specific date.
 */
export async function generateDailyDigest(date, force = false) {
  // Check existing
  const existing = db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(date);
  if (existing && existing.status === 'complete' && !force) {
    return existing;
  }

  // Get emails for the day
  const { emails, groups } = getDayEmailsByCategory(date);

  // Get calendar events for the day
  let events = [];
  try { events = getEventsForDate(date); } catch { /* no calendar data yet */ }

  if (emails.length === 0 && events.length === 0) {
    const id = existing?.id || uuidv4();
    db.prepare(`
      INSERT INTO daily_digests (id, date, status, headline, content, email_count, generated_at)
      VALUES (?, ?, 'complete', 'No emails or events', '{}', 0, datetime('now'))
      ON CONFLICT(date) DO UPDATE SET
        status = 'complete', headline = 'No emails or events', content = '{}',
        email_count = 0, error_msg = NULL, generated_at = datetime('now')
    `).run(id, date);
    return db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(date);
  }

  // Set status to generating
  const id = existing?.id || uuidv4();
  db.prepare(`
    INSERT INTO daily_digests (id, date, status, email_count)
    VALUES (?, ?, 'generating', ?)
    ON CONFLICT(date) DO UPDATE SET
      status = 'generating', email_count = excluded.email_count, error_msg = NULL
  `).run(id, date, emails.length);

  try {
    const userMessage = buildUserMessage(date, groups, events);
    const result = await getJSON(SYSTEM, userMessage, { maxTokens: 6000 });

    const headline = result.headline || 'Daily digest generated';
    const content = JSON.stringify(result);

    db.prepare(`
      UPDATE daily_digests SET status = 'complete', headline = ?, content = ?,
        model = ?, generated_at = datetime('now'), error_msg = NULL
      WHERE date = ?
    `).run(headline, content, await getModel(), date);

    return db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(date);
  } catch (err) {
    console.error(`[DailyDigest] Error generating for ${date}:`, err.message);
    db.prepare(`
      UPDATE daily_digests SET status = 'error', error_msg = ? WHERE date = ?
    `).run(err.message, date);
    return db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(date);
  }
}

/**
 * Generate yesterday's digest if not already complete.
 */
export async function generateYesterdayDigest() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().split('T')[0];

  const existing = db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(date);
  if (existing && existing.status === 'complete') {
    return existing;
  }

  console.log(`[DailyDigest] Auto-generating digest for ${date}`);
  return generateDailyDigest(date);
}

/**
 * Start backfill for a date range (sequential).
 */
export async function startBackfill(from, to) {
  if (backfillState.running) {
    return { error: 'Backfill already running' };
  }

  // Compute dates in range
  const dates = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  // Check which are already complete
  const ph = dates.map(() => '?').join(',');
  const completeSet = new Set(
    db.prepare(`SELECT date FROM daily_digests WHERE date IN (${ph}) AND status = 'complete'`)
      .all(...dates)
      .map(r => r.date)
  );
  const alreadyComplete = dates.filter(date => completeSet.has(date));

  const toGenerate = dates.filter(d => !alreadyComplete.includes(d));

  if (toGenerate.length === 0) {
    return { queued: 0, already_complete: alreadyComplete.length };
  }

  backfillState = { running: true, total: toGenerate.length, completed: 0, current_date: null, errors: [] };

  // Run sequentially in background
  (async () => {
    for (const date of toGenerate) {
      backfillState.current_date = date;
      try {
        await generateDailyDigest(date);
        backfillState.completed++;
      } catch (err) {
        backfillState.errors.push({ date, error: err.message });
        backfillState.completed++;
      }
    }
    backfillState.running = false;
    backfillState.current_date = null;
  })();

  return { queued: toGenerate.length, already_complete: alreadyComplete.length };
}

/**
 * Get current backfill status.
 */
export function getBackfillStatus() {
  return { ...backfillState };
}
