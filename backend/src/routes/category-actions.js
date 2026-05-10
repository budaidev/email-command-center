import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { getActionLog, rerunActionsForEmail } from '../services/action-runner.js';

const router = Router();

// GET /api/category-actions/:categoryId — list actions for a category
router.get('/:categoryId', (req, res) => {
  const actions = db.prepare(
    'SELECT * FROM category_actions WHERE category_id = ? ORDER BY sort_order'
  ).all(req.params.categoryId);
  res.json(actions);
});

// POST /api/category-actions/:categoryId — add action to a category
router.post('/:categoryId', (req, res, next) => {
  try {
    const { type, label, config, sort_order } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });

    const validTypes = ['skip', 'mark_read', 'auto_tag', 'script', 'ai_prompt', 'webhook'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO category_actions (id, category_id, type, label, config, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.categoryId, type, label || type, JSON.stringify(config || {}), sort_order || 0);

    const action = db.prepare('SELECT * FROM category_actions WHERE id = ?').get(id);
    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/category-actions/action/:id — update an action
router.patch('/action/:id', (req, res, next) => {
  try {
    const action = db.prepare('SELECT * FROM category_actions WHERE id = ?').get(req.params.id);
    if (!action) return res.status(404).json({ error: 'Action not found' });

    const { label, config, sort_order, is_active } = req.body;
    if (label !== undefined) db.prepare('UPDATE category_actions SET label = ? WHERE id = ?').run(label, req.params.id);
    if (config !== undefined) db.prepare('UPDATE category_actions SET config = ? WHERE id = ?').run(JSON.stringify(config), req.params.id);
    if (sort_order !== undefined) db.prepare('UPDATE category_actions SET sort_order = ? WHERE id = ?').run(sort_order, req.params.id);
    if (is_active !== undefined) db.prepare('UPDATE category_actions SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);

    res.json(db.prepare('SELECT * FROM category_actions WHERE id = ?').get(req.params.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/category-actions/action/:id
router.delete('/action/:id', (req, res, next) => {
  try {
    const action = db.prepare('SELECT * FROM category_actions WHERE id = ?').get(req.params.id);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    db.prepare('DELETE FROM category_actions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/category-actions/log/:emailId — action log for an email
router.get('/log/:emailId', (req, res) => {
  res.json(getActionLog(req.params.emailId));
});

// POST /api/category-actions/rerun/:emailId — re-run actions for an email
router.post('/rerun/:emailId', async (req, res, next) => {
  try {
    const result = await rerunActionsForEmail(req.params.emailId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
