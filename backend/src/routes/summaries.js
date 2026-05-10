import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { streamChat, getJSON, getModel } from '../services/llm.js';
import * as emailPrompt from '../prompts/summarize-email.js';
import * as dayPrompt from '../prompts/summarize-day.js';
import * as weekPrompt from '../prompts/summarize-week.js';
import { SYSTEM as refSystem, buildUserMessage as refUser } from '../prompts/extract-references.js';

const router = Router();

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

/**
 * Save references extracted from a summary (fire-and-forget).
 */
async function extractAndSaveRefs(summaryId, emailId, content) {
  try {
    const result = await getJSON(refSystem, refUser(content));
    const refs = result.references || [];
    if (refs.length === 0) return;

    const insert = db.prepare(`
      INSERT INTO email_refs (id, summary_id, email_id, type, content, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertAll = db.transaction((items) => {
      for (const r of items) {
        insert.run(uuidv4(), summaryId, emailId || null, r.type, r.content, r.due_date || null);
      }
    });
    insertAll(refs);
    console.log(`[Summary] Extracted ${refs.length} references for summary ${summaryId}`);
  } catch (err) {
    console.error('[Summary] Reference extraction failed:', err.message);
  }
}

/**
 * GET /api/summaries/stream?type=email&id=<emailId>
 * GET /api/summaries/stream?type=day&date=2026-03-20
 * GET /api/summaries/stream?type=week&week=2026-W12
 * GET /api/summaries/stream?type=email&id=<emailId>&refresh=1  (force new)
 *
 * Streams SSE events: start → chunk(s) → done | error
 */
router.get('/stream', async (req, res) => {
  const { type, id, date, week, refresh } = req.query;

  if (!type || !['email', 'day', 'week'].includes(type)) {
    return res.status(400).json({ error: 'type must be email | day | week' });
  }

  let scopeKey;
  if (type === 'email') scopeKey = id;
  else if (type === 'day') scopeKey = date;
  else if (type === 'week') scopeKey = week;

  if (!scopeKey) return res.status(400).json({ error: 'Missing id/date/week parameter' });

  setupSSE(res);
  sseWrite(res, 'start', { type, scope_key: scopeKey });

  try {
    // Check cache (unless refresh requested)
    if (!refresh) {
      const cached = db.prepare('SELECT * FROM summaries WHERE type = ? AND scope_key = ?').get(type, scopeKey);
      if (cached) {
        // For email summaries, invalidate cache if the body was fetched after the summary was generated
        // (body may have been lazy-loaded from IMAP after the summary was created from just the snippet)
        let cacheValid = true;
        if (type === 'email') {
          const email = db.prepare('SELECT body_text, body_html FROM emails WHERE id = ?').get(scopeKey);
          const hasBody = (email?.body_text?.length > 0) || (email?.body_html?.length > 0);
          const summaryMentionsEmpty = cached.content.includes('Empty email') || cached.content.includes('no body') || cached.content.includes('No body');
          if (hasBody && summaryMentionsEmpty) {
            console.log(`[Summary] Cache invalidated for ${scopeKey.slice(0, 8)}… — body now available but cached summary says empty`);
            cacheValid = false;
          }
        }
        if (cacheValid) {
          sseWrite(res, 'chunk', { content: cached.content });
          const refs = db.prepare('SELECT * FROM email_refs WHERE summary_id = ? ORDER BY created_at ASC').all(cached.id);
          sseWrite(res, 'done', { cached: true, refs });
          return res.end();
        }
      }
    }

    // Build messages
    let messages;
    let emailId = null;

    if (type === 'email') {
      const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(scopeKey);
      if (!email) {
        sseWrite(res, 'error', { error: 'Email not found' });
        return res.end();
      }
      emailId = email.id;

      const bodyLen = (email.body_text || '').length;
      const htmlLen = (email.body_html || '').length;
      const snippetLen = (email.snippet || '').length;
      console.log(`[Summary] Email ${email.id.slice(0, 8)}… subject="${(email.subject || '').slice(0, 60)}" body_text=${bodyLen} body_html=${htmlLen} snippet=${snippetLen}`);
      if (bodyLen === 0 && htmlLen === 0) {
        console.warn(`[Summary] WARNING: No body content for email "${email.subject?.slice(0, 40)}" — LLM will only see snippet (${snippetLen} chars)`);
      }

      messages = [
        { role: 'system', content: emailPrompt.SYSTEM },
        { role: 'user', content: emailPrompt.buildUserMessage(email) },
      ];
    } else if (type === 'day') {
      const emails = db.prepare(`
        SELECT * FROM emails WHERE date(date) = ? ORDER BY date DESC LIMIT 100
      `).all(date);
      if (emails.length === 0) {
        sseWrite(res, 'error', { error: 'No emails found for this date' });
        return res.end();
      }
      messages = [
        { role: 'system', content: dayPrompt.SYSTEM },
        { role: 'user', content: dayPrompt.buildUserMessage(date, emails) },
      ];
    } else {
      // week: parse ISO week '2026-W12'
      const [yearStr, weekStr] = scopeKey.split('-W');
      const year = parseInt(yearStr);
      const weekNum = parseInt(weekStr);
      // Get emails for this ISO week — use strftime('%W') (0-indexed, Mon start)
      // SQLite week: %W = week of year (Monday first day, 00..53)
      const emails = db.prepare(`
        SELECT * FROM emails
        WHERE strftime('%Y', date) = ? AND CAST(strftime('%W', date) AS INTEGER) = ?
        ORDER BY date DESC LIMIT 200
      `).all(String(year), weekNum - 1);  // %W is 0-indexed for partial weeks but roughly right
      if (emails.length === 0) {
        sseWrite(res, 'error', { error: 'No emails found for this week' });
        return res.end();
      }
      messages = [
        { role: 'system', content: weekPrompt.SYSTEM },
        { role: 'user', content: weekPrompt.buildUserMessage(scopeKey, emails) },
      ];
    }

    // Stream from LLM
    let fullContent = '';
    console.log(`[Summary] Starting LLM stream for ${type}:${scopeKey.slice(0, 8)}… (prompt ${messages[1].content.length} chars)`);
    await streamChat(messages, (chunk) => {
      fullContent += chunk;
      sseWrite(res, 'chunk', { content: chunk });
    }, { maxTokens: 2000 });
    console.log(`[Summary] LLM response complete: ${fullContent.length} chars`);

    // Save to cache (upsert)
    const summaryId = uuidv4();
    db.prepare(`
      INSERT INTO summaries (id, type, scope_key, content, model)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(type, scope_key) DO UPDATE SET content = excluded.content, model = excluded.model, created_at = datetime('now')
    `).run(summaryId, type, scopeKey, fullContent, await getModel());

    // Get actual id (may differ if it was an update)
    const saved = db.prepare('SELECT id FROM summaries WHERE type = ? AND scope_key = ?').get(type, scopeKey);
    if (saved) extractAndSaveRefs(saved.id, emailId, fullContent);

    sseWrite(res, 'done', { cached: false });
    res.end();
  } catch (err) {
    console.error('[Summary] Stream error:', err.message);
    sseWrite(res, 'error', { error: err.message });
    res.end();
  }
});

/**
 * GET /api/summaries/refs/:emailId — get extracted references for an email
 */
router.get('/refs/:emailId', (req, res, next) => {
  try {
    const summary = db.prepare('SELECT id FROM summaries WHERE type = ? AND scope_key = ?').get('email', req.params.emailId);
    if (!summary) return res.json({ refs: [] });

    const refs = db.prepare('SELECT * FROM email_refs WHERE summary_id = ? ORDER BY type, created_at').all(summary.id);
    res.json({ refs });
  } catch (err) {
    next(err);
  }
});

export default router;
