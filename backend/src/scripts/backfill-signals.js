/**
 * Card #246: compute the deterministic signals (and fetch missing bodies) for every
 * email that lacks the current SIGNALS_VERSION. New mail gets them in the pipeline.
 *
 *   docker exec email-command-center-backend node --env-file=/app/.env src/scripts/backfill-signals.js [--limit N]
 */
import db from '../db.js';
import { prepareEmails, SIGNALS_VERSION } from '../services/signals.js';

const i = process.argv.indexOf('--limit');
const limit = i > 0 ? Number(process.argv[i + 1]) : -1;
const rows = db.prepare(`SELECT e.id, e.account_id, e.uid, e.subject, e.sender_email, e.body_text, e.snippet
  FROM emails e LEFT JOIN email_signals s ON s.email_id = e.id AND s.version = ?
  WHERE s.email_id IS NULL ORDER BY e.date DESC LIMIT ?`).all(SIGNALS_VERSION, limit);
console.log(`${rows.length} emails without signals v${SIGNALS_VERSION}`);
for (let k = 0; k < rows.length; k += 500) {
  await prepareEmails(rows.slice(k, k + 500));
  console.log(`${Math.min(k + 500, rows.length)} done`);
}
const n = db.prepare('SELECT count(*) n FROM email_signals WHERE version = ?').get(SIGNALS_VERSION).n;
console.log(`${n} emails have signals v${SIGNALS_VERSION}`);
process.exit(0);
