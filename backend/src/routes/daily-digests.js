import { Router } from 'express';
import db from '../db.js';
import {
  generateDailyDigest,
  generateYesterdayDigest,
  startBackfill,
  getBackfillStatus,
} from '../services/daily-digest.js';

const router = Router();

// GET /api/daily-digests/today — Today briefing data
router.get('/today', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Count emails arrived today
    const arrived = db.prepare(
      `SELECT COUNT(*) AS count FROM emails WHERE date(date) = ?`
    ).get(today)?.count || 0;

    // Count auto-handled (categorized) emails today
    const handled = db.prepare(
      `SELECT COUNT(*) AS count FROM emails WHERE date(date) = ? AND category_id IS NOT NULL`
    ).get(today)?.count || 0;

    const remaining = arrived - handled;

    // Get existing digest — auto-generate if missing and we have emails
    let digest = db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(today);
    if ((!digest || digest.status !== 'complete') && arrived > 0) {
      // Don't block the request if already generating
      if (!digest || digest.status !== 'generating') {
        generateDailyDigest(today, false).catch(err =>
          console.error('[Today] Auto-generate failed:', err.message)
        );
      }
      // Re-read in case it finished fast (cached/no-op)
      digest = db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(today);
    }

    let highlights = [];
    let fyi = [];
    let summary = null;

    if (digest && digest.content) {
      try {
        const content = JSON.parse(digest.content);

        // New format: content.highlights with kind field
        if (content.highlights && Array.isArray(content.highlights) && content.highlights[0]?.kind) {
          highlights = content.highlights.map(h => ({
            title: h.title || '',
            body: h.body || '',
            emailId: h.emailId || h.email_id || null,
            kind: h.kind || 'fyi',
          }));
        }
        // Old format: action_items → decisions
        else if (content.action_items) {
          highlights = content.action_items
            .filter(item => typeof item === 'object')
            .map(item => ({
              title: item.subject || item.action,
              body: item.action || '',
              emailId: item.email_id || null,
              kind: 'decision',
            }));
        }

        // New format: content.fyi array
        if (content.fyi && Array.isArray(content.fyi)) {
          fyi = content.fyi;
        }
        // Old format: derive from categories
        else if (content.categories) {
          fyi = content.categories
            .filter(c => c.email_count > 0)
            .map(c => ({
              title: `${c.email_count} ${c.name.toLowerCase()} emails processed`,
              kind: 'auto',
              count: c.email_count,
            }));
          if (content.highlights && Array.isArray(content.highlights) && typeof content.highlights[0] === 'string') {
            for (const h of content.highlights.slice(0, 3)) {
              fyi.push({ title: h, kind: 'light' });
            }
          }
        }

        summary = content.summary || content.headline || null;
      } catch {
        // content not parseable
      }
    }

    // Fallback: if still no highlights, use unhandled emails
    if (highlights.length === 0 && arrived > 0) {
      const unhandled = db.prepare(`
        SELECT id, subject, sender_name, sender_email, snippet
        FROM emails
        WHERE date(date) = ? AND category_id IS NULL AND is_read = 0
        ORDER BY date DESC LIMIT 5
      `).all(today);
      highlights = unhandled.map(e => ({
        title: e.subject || '(no subject)',
        body: e.snippet || '',
        emailId: e.id,
        kind: 'decision',
      }));
    }

    res.json({
      date: today,
      arrived,
      handled,
      remaining,
      summary,
      highlights,
      fyi,
      generatedAt: digest?.generated_at || null,
      digestStatus: digest?.status || null,
      digestError: digest?.error_msg || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/daily-digests/month-status — Per-day status for archive grid
router.get('/month-status', (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month query params required' });
    }
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    // Get email counts per day
    const emailCounts = db.prepare(`
      SELECT date(date) AS day, COUNT(*) AS count
      FROM emails
      WHERE strftime('%Y-%m', date) = ?
      GROUP BY date(date)
    `).all(yearMonth);

    const emailMap = {};
    for (const row of emailCounts) {
      emailMap[row.day] = row.count;
    }

    // Get decision counts (uncategorized, unread emails needing decisions)
    const decisionCounts = db.prepare(`
      SELECT date(date) AS day, COUNT(*) AS count
      FROM emails
      WHERE strftime('%Y-%m', date) = ? AND category_id IS NULL AND is_read = 0
      GROUP BY date(date)
    `).all(yearMonth);

    const decisionMap = {};
    for (const row of decisionCounts) {
      decisionMap[row.day] = row.count;
    }

    // Get digests for the month
    const digests = db.prepare(`
      SELECT date, status, generated_at, email_count
      FROM daily_digests
      WHERE strftime('%Y-%m', date) = ?
    `).all(yearMonth);

    const digestMap = {};
    for (const d of digests) {
      digestMap[d.date] = d;
    }

    // Batch-fetch latest email date per day for staleness check
    const latestPerDay = db.prepare(`
      SELECT date(date) AS day, MAX(date) AS latest
      FROM emails
      WHERE strftime('%Y-%m', date) = ?
      GROUP BY date(date)
    `).all(yearMonth);
    const latestMap = {};
    for (const row of latestPerDay) {
      latestMap[row.day] = row.latest;
    }

    // Build per-day results for the whole month
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const emailCount = emailMap[dateStr] || 0;
      const decisionCount = decisionMap[dateStr] || 0;
      const digest = digestMap[dateStr];
      const dow = new Date(dateStr).getDay();
      const isWeekend = dow === 0 || dow === 6;

      let status;
      if (dateStr === today) {
        status = 'today';
      } else if (dateStr > today) {
        status = 'future';
      } else if (digest && digest.status === 'complete') {
        // Check if stale: emails arrived after digest was generated
        const latest = latestMap[dateStr];
        if (latest && digest.generated_at && latest > digest.generated_at) {
          status = 'stale';
        } else {
          status = 'ready';
        }
      } else if (emailCount === 0 || (isWeekend && emailCount < 3)) {
        status = 'weekend';
      } else {
        status = 'never';
      }

      days.push({
        date: dateStr,
        status,
        emailCount,
        decisionCount,
        generatedAt: digest?.generated_at || null,
      });
    }

    res.json(days);
  } catch (err) {
    next(err);
  }
});

// GET /api/daily-digests/backfill/status
router.get('/backfill/status', (req, res) => {
  res.json(getBackfillStatus());
});

// POST /api/daily-digests/backfill
router.post('/backfill', async (req, res, next) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates required' });
    }
    const result = await startBackfill(from, to);
    if (result.error) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/daily-digests/calendar/:yearMonth
router.get('/calendar/:yearMonth', async (req, res, next) => {
  try {
    const { yearMonth } = req.params; // e.g. '2026-03'
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return res.status(400).json({ error: 'Invalid yearMonth format. Use YYYY-MM.' });
    }

    // Get email counts per day for the month
    const emailCounts = db.prepare(`
      SELECT date(date) AS day, COUNT(*) AS count
      FROM emails
      WHERE strftime('%Y-%m', date) = ?
      GROUP BY date(date)
    `).all(yearMonth);

    // Get digests for the month
    const digests = db.prepare(`
      SELECT date, status, headline, email_count
      FROM daily_digests
      WHERE strftime('%Y-%m', date) = ?
    `).all(yearMonth);

    const digestMap = {};
    for (const d of digests) {
      digestMap[d.date] = d;
    }

    const days = emailCounts.map(row => ({
      date: row.day,
      email_count: row.count,
      digest_status: digestMap[row.day]?.status || null,
      headline: digestMap[row.day]?.headline || null,
    }));

    // Also include digest-only days (generated but no emails in range)
    for (const d of digests) {
      if (!emailCounts.find(e => e.day === d.date)) {
        days.push({
          date: d.date,
          email_count: d.email_count,
          digest_status: d.status,
          headline: d.headline,
        });
      }
    }

    days.sort((a, b) => a.date.localeCompare(b.date));

    // Lazy trigger: generate yesterday's digest if missing
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (yesterdayStr.startsWith(yearMonth)) {
      const hasYesterday = digestMap[yesterdayStr];
      if (!hasYesterday || hasYesterday.status !== 'complete') {
        generateYesterdayDigest().catch(err =>
          console.error('[DailyDigest] Lazy generation failed:', err.message)
        );
      }
    }

    res.json({ yearMonth, days });
  } catch (err) {
    next(err);
  }
});

// GET /api/daily-digests/:date
router.get('/:date', (req, res, next) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const digest = db.prepare('SELECT * FROM daily_digests WHERE date = ?').get(date);
    if (!digest) {
      return res.json({ date, status: 'none', content: null });
    }

    // Parse content JSON for the response
    let parsedContent = null;
    if (digest.content) {
      try {
        parsedContent = JSON.parse(digest.content);
      } catch {
        parsedContent = digest.content;
      }
    }

    res.json({ ...digest, content: parsedContent });
  } catch (err) {
    next(err);
  }
});

// POST /api/daily-digests/:date/generate
router.post('/:date/generate', async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const force = req.query.force === '1' || req.query.force === 'true';
    const digest = await generateDailyDigest(date, force);

    // Parse content for response
    let parsedContent = null;
    if (digest.content) {
      try {
        parsedContent = JSON.parse(digest.content);
      } catch {
        parsedContent = digest.content;
      }
    }

    res.json({ ...digest, content: parsedContent });
  } catch (err) {
    next(err);
  }
});

export default router;
