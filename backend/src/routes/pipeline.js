import { Router } from 'express';
import db from '../db.js';
import { runPipeline } from '../services/pipeline.js';

const router = Router();

// GET /api/pipeline/steps — list all pipeline steps
router.get('/steps', (req, res, next) => {
  try {
    const steps = db.prepare('SELECT * FROM pipeline_steps ORDER BY sort_order, created_at').all();
    res.json({ steps });
  } catch (err) { next(err); }
});

// PATCH /api/pipeline/steps/:id — update step config, enable/disable, reorder
router.patch('/steps/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = [];
    const params = [];

    if (updates.is_active !== undefined) { fields.push('is_active = ?'); params.push(updates.is_active ? 1 : 0); }
    if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(updates.sort_order); }
    if (updates.config !== undefined) { fields.push('config = ?'); params.push(typeof updates.config === 'string' ? updates.config : JSON.stringify(updates.config)); }

    if (fields.length > 0) {
      params.push(id);
      db.prepare(`UPDATE pipeline_steps SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    const step = db.prepare('SELECT * FROM pipeline_steps WHERE id = ?').get(id);
    res.json(step);
  } catch (err) { next(err); }
});

// GET /api/pipeline/enrichments/:emailId — full enrichment data
router.get('/enrichments/:emailId', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM email_enrichments WHERE email_id = ?').get(req.params.emailId);
    if (!row) return res.status(404).json({ error: 'No enrichments found' });
    res.json({
      ...row,
      data: JSON.parse(row.data),
      steps_run: JSON.parse(row.steps_run),
    });
  } catch (err) { next(err); }
});

// POST /api/pipeline/run — manual trigger with step/scope control
router.post('/run', async (req, res, next) => {
  try {
    const { emailIds, days, scope, steps: stepFilter } = req.body || {};
    let ids = emailIds;

    if (!ids || !ids.length) {
      if (scope === 'unenriched') {
        // Emails that have never been through the pipeline
        ids = db.prepare(`
          SELECT e.id FROM emails e
          LEFT JOIN email_enrichments ee ON e.id = ee.email_id
          WHERE ee.email_id IS NULL
          ORDER BY e.date DESC
        `).all().map(r => r.id);
      } else if (scope === 'all') {
        ids = db.prepare('SELECT id FROM emails ORDER BY date DESC').all().map(r => r.id);
      } else {
        const lookback = parseInt(days, 10) || 1;
        ids = db.prepare(`
          SELECT id FROM emails WHERE date >= datetime('now', '-' || ? || ' days')
          ORDER BY date DESC
        `).all(lookback).map(r => r.id);
      }
    }

    if (ids.length === 0) return res.json({ queued: 0 });

    const count = ids.length;
    runPipeline(ids, stepFilter || null).catch(err =>
      console.error('[Pipeline] Manual run failed:', err.message)
    );
    res.json({ queued: count });
  } catch (err) { next(err); }
});

// GET /api/pipeline/status — stats about pipeline runs
router.get('/status', (req, res, next) => {
  try {
    const totalEmails = db.prepare('SELECT COUNT(*) as n FROM emails').get().n;
    const enriched = db.prepare('SELECT COUNT(*) as n FROM email_enrichments').get().n;
    const completed = db.prepare("SELECT COUNT(*) as n FROM email_enrichments WHERE completed_at IS NOT NULL").get().n;
    const errors = db.prepare("SELECT COUNT(*) as n FROM email_enrichments WHERE error IS NOT NULL").get().n;
    const inProgress = db.prepare("SELECT COUNT(*) as n FROM email_enrichments WHERE started_at IS NOT NULL AND completed_at IS NULL").get().n;
    const lastRun = db.prepare("SELECT completed_at FROM email_enrichments WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1").get();

    const steps = db.prepare('SELECT * FROM pipeline_steps ORDER BY sort_order').all();

    // Recent errors
    const recentErrors = db.prepare(`
      SELECT ee.email_id, ee.error, e.subject, e.sender_email
      FROM email_enrichments ee
      JOIN emails e ON ee.email_id = e.id
      WHERE ee.error IS NOT NULL
      ORDER BY ee.started_at DESC LIMIT 5
    `).all();

    res.json({
      totalEmails,
      enriched,
      unenriched: totalEmails - enriched,
      completed,
      inProgress,
      errors,
      lastRun: lastRun?.completed_at || null,
      recentErrors,
      steps: steps.map(s => ({
        ...s,
        config: JSON.parse(s.config || '{}'),
      })),
    });
  } catch (err) { next(err); }
});

export default router;
