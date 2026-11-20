/**
 * Decision rules, their backtest, the owner's labels and the domain categories
 * (card #247). UI: Triage > Workbench > Döntési szabályok.
 */
import { Router } from 'express';
import db from '../db.js';
import {
  FIELDS, OPS, VERDICTS, listRules, getRule, saveRule, deleteRule, validateRule,
  backtestRule, storeBacktest, syncLabels, labelStatus,
} from '../services/rules.js';
import { invalidateDomainCategories } from '../services/signals.js';

const router = Router();
const STATUSES = ['draft', 'active', 'off'];

router.get('/', (req, res, next) => {
  try {
    res.json({ rules: listRules(), fields: FIELDS, ops: OPS, verdicts: VERDICTS, labels: labelStatus() });
  } catch (err) { next(err); }
});

function body(req, existing = {}) {
  const b = { ...existing, ...req.body };
  return { id: existing.id, name: b.name, conditions: b.conditions, verdict: b.verdict,
    status: STATUSES.includes(b.status) ? b.status : 'draft', note: b.note, sort_order: Number(b.sort_order) || 0 };
}

router.post('/', (req, res, next) => {
  try {
    const r = body(req);
    const errs = validateRule(r);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });
    res.status(201).json(saveRule(r));
  } catch (err) { next(err); }
});

router.patch('/:id', (req, res, next) => {
  try {
    const existing = getRule(req.params.id);
    if (!existing) return res.status(404).json({ error: 'rule not found' });
    const r = body(req, existing);
    const errs = validateRule(r);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });
    // Activating needs a backtest of exactly this definition, so nothing goes live unmeasured.
    if (r.status === 'active' && existing.status !== 'active') {
      const same = JSON.stringify(r.conditions) === JSON.stringify(existing.conditions) && r.verdict === existing.verdict;
      if (!existing.last_backtest || !same) {
        return res.status(400).json({ error: 'Élesítés előtt futtasd le a backtesztet pontosan erre a változatra.' });
      }
    }
    const changedDefinition = JSON.stringify(r.conditions) !== JSON.stringify(existing.conditions) || r.verdict !== existing.verdict;
    const saved = saveRule(r);
    if (changedDefinition) db.prepare('UPDATE decision_rules SET last_backtest = NULL WHERE id = ?').run(saved.id);
    res.json(getRule(saved.id));
  } catch (err) { next(err); }
});

router.delete('/:id', (req, res, next) => {
  try { deleteRule(req.params.id); res.json({ success: true }); } catch (err) { next(err); }
});

// POST /api/rules/backtest  { name?, conditions, verdict }  — a draft, nothing stored
router.post('/backtest', (req, res, next) => {
  try {
    res.json(backtestRule({ name: req.body.name || 'draft', conditions: req.body.conditions, verdict: req.body.verdict }));
  } catch (err) { if (err.status === 400) return res.status(400).json({ error: err.message }); next(err); }
});

// POST /api/rules/:id/backtest — a saved rule; the summary is stored on it
router.post('/:id/backtest', (req, res, next) => {
  try {
    const rule = getRule(req.params.id);
    if (!rule) return res.status(404).json({ error: 'rule not found' });
    const result = backtestRule(rule);
    storeBacktest(rule.id, result);
    res.json(result);
  } catch (err) { if (err.status === 400) return res.status(400).json({ error: err.message }); next(err); }
});

// POST /api/rules/labels/sync — the owner's labels from Langfuse
router.post('/labels/sync', async (req, res, next) => {
  try { res.json(await syncLabels()); } catch (err) { res.status(502).json({ error: err.message }); }
});

// Domain categories
router.get('/domains', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT domain, category FROM domain_categories ORDER BY category, domain').all();
    const counts = new Map(db.prepare(`SELECT lower(substr(sender_email, instr(sender_email, '@') + 1)) AS d, count(*) AS n
      FROM emails GROUP BY d`).all().map(r => [r.d, r.n]));
    const withCount = rows.map(r => ({ ...r, emails: [...counts].filter(([d]) => d === r.domain || d.endsWith(`.${r.domain}`)).reduce((s, [, n]) => s + n, 0) }));
    res.json({ domains: withCount });
  } catch (err) { next(err); }
});

router.put('/domains/:domain', (req, res, next) => {
  try {
    const domain = String(req.params.domain).toLowerCase().trim();
    const category = String(req.body.category || '').toLowerCase().trim();
    if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/.test(domain) || !/^[a-z_]+$/.test(category)) {
      return res.status(400).json({ error: 'domain like example.hu and a category of letters' });
    }
    db.prepare(`INSERT INTO domain_categories (domain, category) VALUES (?, ?)
      ON CONFLICT(domain) DO UPDATE SET category = excluded.category, updated_at = datetime('now')`).run(domain, category);
    invalidateDomainCategories();
    res.json({ domain, category });
  } catch (err) { next(err); }
});

router.delete('/domains/:domain', (req, res, next) => {
  try {
    db.prepare('DELETE FROM domain_categories WHERE domain = ?').run(String(req.params.domain).toLowerCase());
    invalidateDomainCategories();
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
