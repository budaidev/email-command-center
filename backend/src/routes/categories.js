import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { applyCategoriesToAll, buildCategoryIndex, categorizeEmail, previewCategorization, testRule } from '../services/categorizer.js';
import { getJSON } from '../services/llm.js';
import { buildSuggestRulesPrompt } from '../prompts/suggest-rules.js';

const router = Router();

// GET /api/categories — all categories with their rules
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, created_at').all();
  const rules      = db.prepare('SELECT * FROM category_rules ORDER BY sort_order').all();
  res.json(categories.map(c => ({ ...c, rules: rules.filter(r => r.category_id === c.id) })));
});

// POST /api/categories
router.post('/', (req, res) => {
  const { name, color = '#6366f1', behavior = 'digest-only', sort_order = 0 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO categories (id, name, color, behavior, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(id, name.trim(), color, behavior, sort_order);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

// PATCH /api/categories/:id
router.patch('/:id', (req, res) => {
  const { name, color, behavior, sort_order } = req.body;
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE categories SET name=?, color=?, behavior=?, sort_order=? WHERE id=?')
    .run(name ?? cat.name, color ?? cat.color, behavior ?? cat.behavior, sort_order ?? cat.sort_order, cat.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(cat.id));
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE emails SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/categories/:id/rules
router.post('/:id/rules', (req, res) => {
  const { field, operator, value, sort_order = 0 } = req.body;
  if (!field || !operator || !value) return res.status(400).json({ error: 'field, operator, value required' });
  const id = uuidv4();
  db.prepare('INSERT INTO category_rules (id, category_id, field, operator, value, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.id, field, operator, value.trim(), sort_order);
  res.status(201).json(db.prepare('SELECT * FROM category_rules WHERE id = ?').get(id));
});

// DELETE /api/categories/rules/:ruleId
router.delete('/rules/:ruleId', (req, res) => {
  db.prepare('DELETE FROM category_rules WHERE id = ?').run(req.params.ruleId);
  res.json({ success: true });
});

// GET /api/categories/preview — dry-run counts without saving
router.get('/preview', (req, res) => {
  const result = previewCategorization();
  res.json({ total: result.total, uncategorized_count: result.uncategorized_count, categories: result.categories });
});

// GET /api/categories/preview/emails?group=<categoryId|none>&search=<q>&limit=50&offset=0
router.get('/preview/emails', (req, res) => {
  const { group = 'none', search = '', limit = 100, offset = 0 } = req.query;
  const result = previewCategorization();

  let pool = group === 'none'
    ? result._uncategorized
    : (result._buckets[group] || []);

  if (search.trim()) {
    const q = search.toLowerCase();
    pool = pool.filter(e =>
      (e.subject || '').toLowerCase().includes(q) ||
      (e.sender_email || '').toLowerCase().includes(q) ||
      (e.sender_name || '').toLowerCase().includes(q)
    );
  }

  const total = pool.length;
  const emails = pool.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  res.json({ total, emails });
});

// POST /api/categories/apply — re-categorize all emails
router.post('/apply', (req, res) => {
  const count = applyCategoriesToAll();
  res.json({ success: true, count });
});

// POST /api/categories/suggest-rules — AI suggests new rules from uncategorized emails
router.post('/suggest-rules', async (req, res, next) => {
  try {
    const { sample_size = 50 } = req.body;

    // Get uncategorized emails
    const preview = previewCategorization();
    const sample  = preview._uncategorized.slice(0, sample_size);

    if (sample.length === 0) return res.json({ suggestions: [] });

    // Build prompt with categories + rules
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    const rules      = db.prepare('SELECT * FROM category_rules').all();
    const catsWithRules = categories.map(c => ({ ...c, rules: rules.filter(r => r.category_id === c.id) }));

    const { system, user } = buildSuggestRulesPrompt(catsWithRules, sample);
    const result = await getJSON(system, user);

    const rawSuggestions = Array.isArray(result.suggestions) ? result.suggestions : [];

    // Enrich with actual match count against ALL uncategorized emails
    const suggestions = rawSuggestions
      .filter(s => s?.rule?.field && s?.rule?.operator && s?.rule?.value)
      .map(s => ({
        ...s,
        match_count: preview._uncategorized.filter(e => testRule(e, s.rule)).length,
      }))
      .sort((a, b) => b.match_count - a.match_count);

    res.json({ suggestions, uncategorized_total: preview._uncategorized.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/digest?period=1d|7d|30d
router.get('/digest', (req, res) => {
  const period = req.query.period || '1d';
  const days   = period === '30d' ? 30 : period === '7d' ? 7 : 1;
  const from   = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString();

  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, created_at').all();
  const emails     = db.prepare(`
    SELECT id, subject, sender_name, sender_email, date, is_read, snippet, category_id
    FROM emails WHERE date >= ? ORDER BY date DESC
  `).all(fromStr);

  const catMap = {};
  for (const c of categories) {
    catMap[c.id] = { ...c, count: 0, unread: 0, emails: [] };
  }
  const uncategorized = { id: null, name: 'Uncategorized', color: '#4b5563', behavior: 'digest-only', sort_order: 999, count: 0, unread: 0, emails: [] };

  for (const e of emails) {
    const group = (e.category_id && catMap[e.category_id]) ? catMap[e.category_id] : uncategorized;
    group.count++;
    if (!e.is_read) group.unread++;
    group.emails.push({ id: e.id, subject: e.subject, sender_name: e.sender_name, date: e.date, is_read: e.is_read, snippet: e.snippet });
  }

  const groups = [
    ...categories.map(c => catMap[c.id]),
    ...(uncategorized.count > 0 ? [uncategorized] : []),
  ].filter(g => g.count > 0 && g.behavior !== 'silent');

  res.json({ period, from: fromStr, total: emails.length, groups });
});

export default router;
