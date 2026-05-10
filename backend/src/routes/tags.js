import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { getJSON } from '../services/llm.js';
import { buildSuggestTagsPrompt } from '../prompts/suggest-tags.js';

const router = Router();

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#14b8a6'];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// GET /api/tags — all tags
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM tags ORDER BY name').all());
});

// POST /api/tags — create (or return existing) tag
router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name.trim());
  if (existing) return res.json(existing);
  const tag = { id: uuidv4(), name: name.trim(), color: color || randomColor() };
  db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(tag.id, tag.name, tag.color);
  res.status(201).json(tag);
});

// DELETE /api/tags/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/tags/email/:emailId — tags on an email
router.get('/email/:emailId', (req, res) => {
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN email_tags et ON et.tag_id = t.id
    WHERE et.email_id = ?
    ORDER BY t.name
  `).all(req.params.emailId);
  res.json(tags);
});

// POST /api/tags/email/:emailId — attach tag to email
router.post('/email/:emailId', (req, res) => {
  const { tag_id } = req.body;
  if (!tag_id) return res.status(400).json({ error: 'tag_id required' });
  db.prepare('INSERT OR IGNORE INTO email_tags (email_id, tag_id) VALUES (?, ?)').run(req.params.emailId, tag_id);
  res.json({ success: true });
});

// DELETE /api/tags/email/:emailId/:tagId — detach tag from email
router.delete('/email/:emailId/:tagId', (req, res) => {
  db.prepare('DELETE FROM email_tags WHERE email_id = ? AND tag_id = ?').run(req.params.emailId, req.params.tagId);
  res.json({ success: true });
});

// GET /api/tags/suggest/:emailId — AI tag suggestions
router.get('/suggest/:emailId', async (req, res, next) => {
  try {
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.emailId);
    if (!email) return res.status(404).json({ error: 'Email not found' });

    const allTags = db.prepare('SELECT * FROM tags').all();
    const { system, user } = buildSuggestTagsPrompt(email, allTags);
    const result = await getJSON(system, user);
    const names = Array.isArray(result.tags) ? result.tags : [];

    const suggestions = names.slice(0, 5).map(name => {
      const match = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
      return match || { id: null, name: String(name).slice(0, 30), color: randomColor() };
    });

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

export default router;
