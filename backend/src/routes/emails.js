import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import * as imap from '../services/imap.js';

const router = Router();

// GET /api/emails — paginated list, sorted newest first
router.get('/', (req, res, next) => {
  try {
    let sql = `
      SELECT e.*, a.label as account_label, a.color as account_color, a.email as account_email,
        c.name as category_name, c.color as category_color,
        (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
         FROM tags t JOIN email_tags et ON et.tag_id = t.id WHERE et.email_id = e.id) as tags
      FROM emails e
      JOIN accounts a ON a.id = e.account_id
      LEFT JOIN categories c ON c.id = e.category_id
      WHERE 1=1
    `;
    const params = [];
    const { account_id, limit = 50, offset = 0, unread_only, category_id } = req.query;

    if (account_id) {
      sql += ' AND e.account_id = ?';
      params.push(account_id);
    }
    if (unread_only === 'true') {
      sql += ' AND e.is_read = 0';
    }
    if (category_id === 'none') {
      sql += ' AND e.category_id IS NULL';
    } else if (category_id) {
      sql += ' AND e.category_id = ?';
      params.push(category_id);
    }

    sql += ' ORDER BY e.date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const emails = db.prepare(sql).all(...params);

    // Build count query with same filters
    let countSql = 'SELECT COUNT(*) as n FROM emails e WHERE 1=1';
    const countParams = [];
    if (account_id) { countSql += ' AND e.account_id = ?'; countParams.push(account_id); }
    if (unread_only === 'true') { countSql += ' AND e.is_read = 0'; }
    if (category_id === 'none') { countSql += ' AND e.category_id IS NULL'; }
    else if (category_id) { countSql += ' AND e.category_id = ?'; countParams.push(category_id); }
    const total = db.prepare(countSql).get(...countParams).n;

    res.json({ emails, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    next(err);
  }
});

// GET /api/emails/search?q=... — full-text search
router.get('/search', (req, res, next) => {
  try {
    const { q, limit = 30 } = req.query;
    if (!q) return res.json({ emails: [] });

    const emails = db.prepare(`
      SELECT e.*, a.label as account_label, a.color as account_color
      FROM emails e
      JOIN accounts a ON a.id = e.account_id
      WHERE e.rowid IN (
        SELECT rowid FROM emails_fts WHERE emails_fts MATCH ?
      )
      ORDER BY e.date DESC LIMIT ?
    `).all(q, parseInt(limit));

    res.json({ emails });
  } catch (err) {
    next(err);
  }
});

// GET /api/emails/:id — single email with full body
router.get('/:id', async (req, res, next) => {
  try {
    const email = db.prepare(`
      SELECT e.*, a.label as account_label, a.color as account_color, a.imap_user, a.imap_pass
      FROM emails e
      JOIN accounts a ON a.id = e.account_id
      WHERE e.id = ?
    `).get(req.params.id);

    if (!email) return res.status(404).json({ error: 'Email not found' });

    // If body not yet fetched, fetch it now
    if (!email.body_text && !email.body_html) {
      const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(email.account_id);
      const full = await imap.fetchMessage(account, email.uid);
      if (full) {
        db.prepare(`
          UPDATE emails SET body_text = ?, body_html = ?, snippet = ?, message_id = ?
          WHERE id = ?
        `).run(full.body_text, full.body_html, full.snippet, full.message_id, email.id);
        Object.assign(email, full);
      }
    }

    // Mark as read
    if (!email.is_read) {
      db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').run(email.id);
      const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(email.account_id);
      imap.markRead(account, email.uid).catch(console.error);
      email.is_read = 1;
    }

    // Strip IMAP credentials before returning
    delete email.imap_user;
    delete email.imap_pass;

    res.json(email);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/emails/:id — permanently delete
router.delete('/:id', async (req, res, next) => {
  try {
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    if (!email) return res.status(404).json({ error: 'Email not found' });

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(email.account_id);
    await imap.deleteMessage(account, email.uid);
    db.prepare('DELETE FROM emails WHERE id = ?').run(email.id);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/emails/:id/read — mark as read/unread
router.post('/:id/read', async (req, res, next) => {
  try {
    const { read = true } = req.body;
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    if (!email) return res.status(404).json({ error: 'Email not found' });

    db.prepare('UPDATE emails SET is_read = ? WHERE id = ?').run(read ? 1 : 0, email.id);

    if (read) {
      const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(email.account_id);
      imap.markRead(account, email.uid).catch(console.error);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
