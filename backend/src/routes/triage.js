import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import {
  triageEmails,
  summarizeLearnedPreferences,
  buildPromptPreview,
  runBacktest,
} from '../services/triage.js';
import { testScoringRules } from '../services/scoring.js';
import { getSetting, setSetting } from '../utils/settings.js';

const router = Router();

// GET /api/triage — scored emails sorted by score
router.get('/', (req, res, next) => {
  try {
    const minScore = parseInt(req.query.min_score) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const { date } = req.query;

    let sql = `
      SELECT t.email_id, t.score, t.rule_score, t.ai_score, t.matched_rules,
             t.action_type, t.reason, t.suggested_task,
             t.created_at AS triage_at,
             e.subject, e.sender_name, e.sender_email, e.date, e.snippet,
             e.category_id, e.is_read, e.gtd_task_id,
             c.name AS category_name, c.color AS category_color,
             f.decision AS feedback_decision
      FROM triage_results t
      JOIN emails e ON t.email_id = e.id
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN (
        SELECT email_id, decision FROM triage_feedback
        WHERE id IN (SELECT MAX(id) FROM triage_feedback GROUP BY email_id)
      ) f ON t.email_id = f.email_id
      WHERE t.score >= ?
    `;
    const params = [minScore];

    if (date) {
      sql += ' AND date(e.date) = ?';
      params.push(date);
    }

    // Count total before applying LIMIT/OFFSET
    const countSql = sql.replace(/SELECT.*?FROM triage_results/s, 'SELECT COUNT(*) AS n FROM triage_results');
    const total = db.prepare(countSql).get(...params).n;

    sql += ' ORDER BY t.score DESC, e.date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = db.prepare(sql).all(...params);
    res.json({ results, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/triage/run — manual trigger
router.post('/run', async (req, res, next) => {
  try {
    const { emailIds } = req.body || {};
    let ids = emailIds;

    if (!ids || !ids.length) {
      // Default: un-triaged emails from last 7 days
      ids = db.prepare(`
        SELECT e.id FROM emails e
        LEFT JOIN triage_results t ON e.id = t.email_id
        WHERE t.email_id IS NULL AND e.date >= datetime('now', '-7 days')
        ORDER BY e.date DESC
      `).all().map(r => r.id);
    }

    if (ids.length === 0) return res.json({ triaged: 0 });

    const count = await triageEmails(ids, true);
    res.json({ triaged: count });
  } catch (err) {
    next(err);
  }
});

// POST /api/triage/:emailId/feedback — store user decision
router.post('/:emailId/feedback', (req, res, next) => {
  try {
    const { emailId } = req.params;
    const { decision, reason } = req.body;

    if (!['approve', 'dismiss', 'create_task'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approve, dismiss, or create_task' });
    }

    const triage = db.prepare(
      'SELECT score, action_type FROM triage_results WHERE email_id = ?'
    ).get(emailId);

    db.prepare(`
      INSERT INTO triage_feedback (id, email_id, decision, triage_score, triage_action, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), emailId, decision,
      triage?.score ?? null, triage?.action_type ?? null,
      reason || null,
    );

    // Check if we should re-summarize preferences (every 20 decisions)
    const feedbackCount = db.prepare('SELECT COUNT(*) AS n FROM triage_feedback').get().n;
    if (feedbackCount > 0 && feedbackCount % 20 === 0) {
      summarizeLearnedPreferences().catch(err =>
        console.error('[Triage] Preference summarization failed:', err.message)
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/triage/preferences — current instructions + learned profile + stats
router.get('/preferences', (req, res, next) => {
  try {
    const instructions = getSetting('triage_instructions');
    const learnedProfile = getSetting('triage_learned_profile');
    const enabled = getSetting('triage_enabled') !== 'false';

    const stats = db.prepare(`
      SELECT decision, COUNT(*) AS count FROM triage_feedback GROUP BY decision
    `).all();

    const evaluation = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(status = 'not_evaluated') AS notEvaluated,
             MAX(CASE WHEN status = 'not_evaluated' THEN updated_at END) AS lastFailureAt,
             (SELECT error FROM triage_results WHERE status = 'not_evaluated' ORDER BY updated_at DESC LIMIT 1) AS lastError
      FROM triage_results
    `).get();

    res.json({ instructions, learnedProfile, enabled, stats, evaluation });
  } catch (err) {
    next(err);
  }
});

// PUT /api/triage/preferences — update instructions and/or enabled
router.put('/preferences', (req, res, next) => {
  try {
    const { instructions, enabled } = req.body;
    if (instructions !== undefined) setSetting('triage_instructions', instructions);
    if (enabled !== undefined) setSetting('triage_enabled', String(enabled));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/triage/summarize-preferences — force re-summarize learned profile
router.post('/summarize-preferences', async (req, res, next) => {
  try {
    await summarizeLearnedPreferences();
    const profile = getSetting('triage_learned_profile');
    res.json({ success: true, profile });
  } catch (err) {
    next(err);
  }
});

// GET /api/triage/prompt-preview — show the exact prompt the AI would send
router.get('/prompt-preview', (req, res, next) => {
  try {
    const sampleSize = parseInt(req.query.sample_size) || 5;
    const preview = buildPromptPreview(sampleSize);
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

// GET /api/triage/feedback-history — paginated detailed feedback log
router.get('/feedback-history', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const { decision, search } = req.query;

    let sql = `
      SELECT f.id, f.email_id, f.decision, f.reason, f.triage_score, f.triage_action, f.created_at,
             e.subject, e.sender_name, e.sender_email,
             c.name AS category_name
      FROM triage_feedback f
      JOIN emails e ON f.email_id = e.id
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (decision) {
      sql += ' AND f.decision = ?';
      params.push(decision);
    }
    if (search) {
      sql += ' AND (e.subject LIKE ? OR e.sender_name LIKE ? OR e.sender_email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS n FROM');
    const total = db.prepare(countSql).get(...params).n;

    sql += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const decisions = db.prepare(sql).all(...params);
    res.json({ decisions, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/triage/feedback/:feedbackId/flip — change an existing feedback decision
router.post('/feedback/:feedbackId/flip', (req, res, next) => {
  try {
    const { feedbackId } = req.params;
    const { decision } = req.body;
    if (!['approve', 'dismiss', 'create_task'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }
    const result = db.prepare('UPDATE triage_feedback SET decision = ? WHERE id = ?').run(decision, feedbackId);
    if (result.changes === 0) return res.status(404).json({ error: 'Feedback not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Scoring Rules CRUD ───

// GET /api/triage/scoring-rules
router.get('/scoring-rules', (req, res, next) => {
  try {
    const rules = db.prepare('SELECT * FROM scoring_rules ORDER BY sort_order, created_at').all();
    res.json({ rules });
  } catch (err) { next(err); }
});

// POST /api/triage/scoring-rules
router.post('/scoring-rules', (req, res, next) => {
  try {
    const { field, operator, value, score, action_type, label } = req.body;
    if (!field || !operator || !value || score === undefined) {
      return res.status(400).json({ error: 'field, operator, value, and score are required' });
    }
    const id = uuidv4();
    const clamped = Math.max(-50, Math.min(50, Math.round(Number(score))));
    db.prepare(`
      INSERT INTO scoring_rules (id, field, operator, value, score, action_type, label)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, field, operator, value, clamped, action_type || null, label || '');
    const rule = db.prepare('SELECT * FROM scoring_rules WHERE id = ?').get(id);
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

// PATCH /api/triage/scoring-rules/:id
router.patch('/scoring-rules/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = [];
    const params = [];
    for (const key of ['field', 'operator', 'value', 'label', 'action_type']) {
      if (updates[key] !== undefined) { fields.push(`${key} = ?`); params.push(updates[key]); }
    }
    if (updates.score !== undefined) { fields.push('score = ?'); params.push(Math.max(-50, Math.min(50, Math.round(Number(updates.score))))); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); params.push(updates.is_active ? 1 : 0); }
    if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(updates.sort_order); }
    if (fields.length === 0) return res.json({ success: true });
    params.push(id);
    db.prepare(`UPDATE scoring_rules SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    const rule = db.prepare('SELECT * FROM scoring_rules WHERE id = ?').get(id);
    res.json(rule);
  } catch (err) { next(err); }
});

// DELETE /api/triage/scoring-rules/:id
router.delete('/scoring-rules/:id', (req, res, next) => {
  try {
    db.prepare('DELETE FROM scoring_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/triage/scoring-rules/test — dry-run rules against recent emails
router.post('/scoring-rules/test', (req, res, next) => {
  try {
    const limit = parseInt(req.body?.limit) || 20;
    const emailIds = db.prepare('SELECT id FROM emails ORDER BY date DESC LIMIT ?').all(limit).map(r => r.id);
    const results = testScoringRules(emailIds);
    res.json({ results });
  } catch (err) { next(err); }
});

// POST /api/triage/backtest — test draft instructions against emails with feedback
router.post('/backtest', async (req, res, next) => {
  try {
    const { instructions, learnedProfile, limit } = req.body || {};
    const result = await runBacktest(instructions, learnedProfile, limit || 20);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
