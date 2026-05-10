import { Router } from 'express';
import { syncAccount, getSyncStatus } from '../services/sync.js';
import db from '../db.js';

const router = Router();

// GET /api/sync/status — current sync state for all accounts
router.get('/status', (req, res) => {
  res.json(getSyncStatus());
});

// POST /api/sync/trigger — manually trigger a sync
router.post('/trigger', async (req, res, next) => {
  try {
    const { account_id } = req.body;
    const accounts = account_id
      ? [db.prepare('SELECT * FROM accounts WHERE id = ? AND is_active = 1').get(account_id)].filter(Boolean)
      : db.prepare('SELECT * FROM accounts WHERE is_active = 1').all();

    // Fire and forget — don't await
    Promise.all(accounts.map(a => syncAccount(a))).catch(console.error);

    res.json({ triggered: accounts.length });
  } catch (err) {
    next(err);
  }
});

export default router;
