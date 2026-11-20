/**
 * Card #246: check a hard rule against the LLM on emails outside the labelled set.
 *
 *   docker exec email-command-center-backend node --env-file=/app/.env src/scripts/llm-check.js IDS.json OUT.json [--model email-llm-strong]
 *
 * IDS.json: [email_id]. Writes { model, rows: [{email_id, important, criteria, why} | {email_id, error}] }
 * every 25 emails, and resumes from OUT.json when it exists (rows with an error are retried).
 * Files in /app/data/llm-checks/ are shown as an LLM source in the rule backtest (card #247).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import db from '../db.js';
import { evaluateOne } from '../services/importance.js';
import { getTextPrompt } from '../services/langfuse.js';
import { IMPORTANCE_PROMPT_NAME, LOCAL_SYSTEM, CRITERIA } from '../prompts/importance.js';

const [idsFile, outFile] = process.argv.slice(2);
const mi = process.argv.indexOf('--model');
const model = mi > 0 ? process.argv[mi + 1] : 'email-llm-strong';
const ids = JSON.parse(readFileSync(idsFile, 'utf8'));
const prompt = await getTextPrompt(IMPORTANCE_PROMPT_NAME, 'production', LOCAL_SYSTEM);
const get = db.prepare(`SELECT id, account_id, uid, subject, sender_name, sender_email, recipients, date, snippet,
  body_text, message_id FROM emails WHERE id = ?`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const labelArg = process.argv.indexOf('--label');
const sourceName = labelArg > 0 ? process.argv[labelArg + 1] : model;
const prev = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
const out = (prev?.rows || prev || []).filter(r => !r.error);
const done = new Set(out.map(r => r.email_id));
const save = () => writeFileSync(outFile, JSON.stringify({ model: sourceName, rows: out }, null, 1));
let n = 0;
for (const id of ids) {
  if (done.has(id)) continue;
  if (++n % 25 === 0) save();
  const email = get.get(id);
  for (let attempt = 0; ; attempt++) {
    try {
      const ev = await evaluateOne(email, prompt, { model, tags: ['ecc-rule-check'] });
      out.push({ email_id: id, important: ev.important,
        criteria: Object.fromEntries(CRITERIA.map(c => [c, ev.criteria[c].answer])), why: ev.why });
      process.stdout.write('.');
      break;
    } catch (err) {
      if (attempt < 5 && /\b(429|500|502|503)\b/.test(err.message)) { process.stdout.write('w'); await sleep(70_000); continue; }
      out.push({ email_id: id, error: err.message.slice(0, 200) });
      process.stdout.write('x');
      break;
    }
  }
}
save();
console.log(`\n${out.filter(x => !x.error).length}/${ids.length} evaluated, ${out.filter(x => x.important).length} important -> ${outFile}`);
process.exit(0);
