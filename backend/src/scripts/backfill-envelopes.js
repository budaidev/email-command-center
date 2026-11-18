/**
 * One-off (card #238, 2026-11-18): fill emails.message_id, emails.received_at and the
 * mail's own date for rows synced before the sync stored them. Reads envelopes from
 * the local mailserver only (no Gmail traffic).
 *
 *   docker exec email-command-center-backend node --env-file=/app/.env src/scripts/backfill-envelopes.js [--dry-run]
 */
import db from '../db.js';
import { fetchEnvelopes } from '../services/imap.js';

const dryRun = process.argv.includes('--dry-run');
const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1').all();
const update = db.prepare(`
  UPDATE emails SET date = ?, message_id = COALESCE(message_id, ?), received_at = ?
   WHERE account_id = ? AND uid = ?
`);

for (const account of accounts) {
  const rows = db.prepare('SELECT uid FROM emails WHERE account_id = ?').all(account.id);
  const want = new Set(rows.map(r => r.uid));
  console.log(`[backfill] ${account.id}: ${want.size} emails in the app, reading INBOX envelopes...`);
  const envelopes = await fetchEnvelopes(account, 1_000_000);
  const found = envelopes.filter(m => want.has(m.uid));
  let moved = 0;
  const run = db.transaction(() => {
    for (const m of found) {
      if (dryRun) continue;
      update.run(m.date, m.message_id, m.received_at, account.id, m.uid);
    }
  });
  const before = new Map(db.prepare('SELECT uid, date FROM emails WHERE account_id = ?').all(account.id).map(r => [r.uid, r.date]));
  for (const m of found) if (before.get(m.uid) !== m.date) moved++;
  run();
  console.log(`[backfill] ${account.id}: ${envelopes.length} envelopes, ${found.length} matched, ` +
    `${found.filter(m => m.message_id).length} with Message-ID, ${moved} dates changed${dryRun ? ' (dry run, nothing written)' : ''}; ` +
    `${want.size - found.length} app emails not in INBOX`);
}
