import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { testConnection } from '../services/imap.js';
import { syncAccount, startIdleWatcher, stopIdleWatcher } from '../services/sync.js';

const router = Router();

// GET /api/accounts — list all accounts (never return passwords)
router.get('/', (req, res) => {
  const accounts = db.prepare(`
    SELECT id, email, label, color, imap_user, last_uid, is_active, created_at,
           caldav_url, caldav_user
    FROM accounts ORDER BY created_at ASC
  `).all();
  res.json(accounts);
});

// POST /api/accounts — add a new account
router.post('/', async (req, res, next) => {
  try {
    const { email, label, color, imap_user, imap_pass } = req.body;

    if (!email || !imap_user || !imap_pass) {
      return res.status(400).json({ error: 'email, imap_user and imap_pass are required' });
    }

    // Test credentials before saving
    await testConnection(imap_user, imap_pass);

    const id = uuidv4();
    const encrypted = encrypt(imap_pass);

    db.prepare(`
      INSERT INTO accounts (id, email, label, color, imap_user, imap_pass)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, email, label || email, color || '#6366f1', imap_user, encrypted);

    const newAccount = { id, email, label: label || email, color: color || '#6366f1', imap_user, imap_pass: encrypted, last_uid: 0, is_active: 1 };
    // Kick off initial sync + start IDLE watcher for new account
    syncAccount(newAccount).then(() => startIdleWatcher(newAccount)).catch(console.error);

    res.status(201).json({
      id, email, label: label || email, color: color || '#6366f1',
      imap_user, last_uid: 0, is_active: 1,
    });
  } catch (err) {
    if (err.message?.includes('auth') || err.message?.includes('LOGIN')) {
      return res.status(401).json({ error: 'IMAP authentication failed — check credentials' });
    }
    next(err);
  }
});

// PATCH /api/accounts/:id — update label/color/active/caldav
router.patch('/:id', (req, res, next) => {
  try {
    const { label, color, is_active, caldav_url, caldav_user, caldav_pass } = req.body;
    const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (label !== undefined) db.prepare('UPDATE accounts SET label = ? WHERE id = ?').run(label, req.params.id);
    if (color !== undefined) db.prepare('UPDATE accounts SET color = ? WHERE id = ?').run(color, req.params.id);
    if (is_active !== undefined) db.prepare('UPDATE accounts SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
    if (caldav_url !== undefined) db.prepare('UPDATE accounts SET caldav_url = ? WHERE id = ?').run(caldav_url || null, req.params.id);
    if (caldav_user !== undefined) db.prepare('UPDATE accounts SET caldav_user = ? WHERE id = ?').run(caldav_user || null, req.params.id);
    if (caldav_pass !== undefined) db.prepare('UPDATE accounts SET caldav_pass = ? WHERE id = ?').run(caldav_pass ? encrypt(caldav_pass) : null, req.params.id);

    const updated = db.prepare('SELECT id, email, label, color, imap_user, last_uid, is_active, caldav_url, caldav_user FROM accounts WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/accounts/:id — remove account + cascade delete emails
router.delete('/:id', (req, res, next) => {
  try {
    const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    stopIdleWatcher(req.params.id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
