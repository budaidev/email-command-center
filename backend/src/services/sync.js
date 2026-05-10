import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { fetchEnvelopes, fetchSince, watchInbox } from './imap.js';
import { applyCategoriesToNew } from './categorizer.js';

// In-memory sync state per account
const syncState = {};

// Active IDLE watchers: accountId → { stop() }
const idleWatchers = {};

export function getSyncStatus() {
  return syncState;
}

/**
 * Sync a single account — fetch new emails and store in SQLite.
 */
export async function syncAccount(account) {
  const accountId = account.id;

  if (syncState[accountId]?.running) {
    console.log(`[Sync] ${account.email} already syncing, skipping`);
    return;
  }

  syncState[accountId] = { running: true, lastSync: null, error: null, newCount: 0 };

  try {
    const lastUid = account.last_uid || 0;
    let messages;

    if (lastUid === 0) {
      console.log(`[Sync] ${account.email} — initial fetch (last 500)`);
      messages = await fetchEnvelopes(account, 500);
    } else {
      console.log(`[Sync] ${account.email} — incremental since UID ${lastUid}`);
      messages = await fetchSince(account, lastUid);
    }

    if (messages.length === 0) {
      syncState[accountId] = { running: false, lastSync: new Date().toISOString(), error: null, newCount: 0 };
      return;
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO emails
        (id, account_id, uid, subject, sender_name, sender_email, recipients, date, is_read, labels, snippet)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((msgs) => {
      const newIds = [];
      for (const msg of msgs) {
        const id = uuidv4();
        const result = insert.run(
          id, accountId, msg.uid,
          msg.subject, msg.sender_name, msg.sender_email,
          msg.recipients, msg.date, msg.is_read, msg.labels,
          msg.snippet || null
        );
        if (result.changes > 0) newIds.push(id);
      }
      return newIds;
    });

    const newIds  = insertMany(messages);
    const newCount = newIds.length;
    // Run the full enrichment → scoring pipeline (fire-and-forget)
    if (newIds.length > 0) {
      import('./pipeline.js').then(({ runPipeline }) =>
        runPipeline(newIds).catch(err =>
          console.error('[Pipeline] Error:', err.message)
        )
      );
    }

    // Update last_uid to highest UID seen
    const maxUid = Math.max(...messages.map(m => m.uid));
    db.prepare('UPDATE accounts SET last_uid = ? WHERE id = ?').run(maxUid, accountId);

    console.log(`[Sync] ${account.email} — ${newCount} new, ${messages.length} total fetched`);
    syncState[accountId] = {
      running: false,
      lastSync: new Date().toISOString(),
      error: null,
      newCount,
    };
  } catch (err) {
    console.error(`[Sync] ${account.email} error:`, err.message);
    syncState[accountId] = {
      running: false,
      lastSync: new Date().toISOString(),
      error: err.message,
      newCount: 0,
    };
  }
}

/**
 * Sync all active accounts.
 */
export async function syncAll() {
  const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1').all();
  await Promise.all(accounts.map(syncAccount));
}

/**
 * Start IMAP IDLE watcher for a single account.
 * Stops any existing watcher first (idempotent).
 */
export function startIdleWatcher(account) {
  stopIdleWatcher(account.id);
  console.log(`[IDLE] Starting watcher for ${account.email}`);
  idleWatchers[account.id] = watchInbox(account, async (acct) => {
    // Re-read account from DB to get latest last_uid
    const fresh = db.prepare('SELECT * FROM accounts WHERE id = ?').get(acct.id);
    if (fresh) await syncAccount(fresh);
  });
}

/**
 * Stop the IDLE watcher for an account.
 */
export function stopIdleWatcher(accountId) {
  if (idleWatchers[accountId]) {
    idleWatchers[accountId].stop();
    delete idleWatchers[accountId];
  }
}

/**
 * Start IDLE watchers for all active accounts.
 */
export function startAllIdleWatchers() {
  const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1').all();
  for (const account of accounts) {
    startIdleWatcher(account);
  }
}

/**
 * Stop all IDLE watchers (for graceful shutdown).
 */
export function stopAllIdleWatchers() {
  for (const accountId of Object.keys(idleWatchers)) {
    stopIdleWatcher(accountId);
  }
}
