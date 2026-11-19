/**
 * Card #241: backtest the importance rubric on the owner's labelled test set.
 *
 *   docker exec email-command-center-backend node --env-file=/app/.env src/scripts/backtest.js \
 *     [--model email-llm] [--prompt-version N | --prompt-label production] [--run NAME] [--limit N]
 *   docker exec email-command-center-backend node --env-file=/app/.env src/scripts/backtest.js \
 *     --compare RUN_A RUN_B        (two finished runs: agreement and confidence tiers)
 *
 * A run evaluates every active item of the Langfuse dataset DATASET with the given
 * model and prompt version and becomes a Langfuse experiment on that dataset (one trace
 * per email in environment "ecc-backtest", with input, answer, the label as expected
 * output and per-item match scores; v4 events-only takes experiments only as OTel span
 * attributes), so runs can be compared side by side under Datasets. The metrics are printed and saved,
 * with the answers, to /app/data/backtests/<run>.json (personal data, local only).
 *
 * Ground truth is the owner's labels (dataset item expectedOutput, filled by
 * scripts/sync_labels.py). "Old system" is the pre-#239 triage (score >= 50) from
 * the 2026-11-18 database backup, when that file is present.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import db from '../db.js';
import { evaluateOne, IMPORTANCE_MODEL, promptLabel } from '../services/importance.js';
import { getTextPrompt } from '../services/langfuse.js';
import { IMPORTANCE_PROMPT_NAME, LOCAL_SYSTEM, CRITERIA, buildEmailMessage } from '../prompts/importance.js';
import { DATASET, lf } from './build-label-set.js';

const OUT_DIR = '/app/data/backtests';
const OLD_DB = '/app/data/email-center.backup-2026-11-18.db';
const CONCURRENCY = Number(process.env.BACKTEST_CONCURRENCY || 1);
// cli-proxy answers 500 when the subscription's short-term limit is hit, and LiteLLM
// then cools the route down for 60 s (429). Wait it out instead of losing the item.
const RETRY_WAIT_MS = 70_000;
const RETRIES = 5;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['important', ...CRITERIA];

function args() {
  const a = process.argv.slice(2);
  const get = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  if (a.includes('--compare')) return { compare: [get('--compare'), a[a.indexOf('--compare') + 2]] };
  return {
    model: get('--model', IMPORTANCE_MODEL),
    version: get('--prompt-version'),
    label: get('--prompt-label', 'production'),
    run: get('--run'),
    limit: Number(get('--limit', 0)) || 0,
  };
}

/** Counts and rates of predicted vs labelled booleans. */
function metrics(pairs) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const [pred, truth] of pairs) {
    if (pred && truth) tp++; else if (pred) fp++; else if (truth) fn++; else tn++;
  }
  const r = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  return { n: pairs.length, tp, fp, fn, tn, recall: r(tp, tp + fn), precision: r(tp, tp + fp), accuracy: r(tp + tn, pairs.length) };
}

function report(rows, predOf) {
  const out = {};
  for (const f of FIELDS) {
    const pairs = rows.filter(x => predOf(x, f) !== undefined).map(x => [predOf(x, f), x.truth[f]]);
    out[f] = metrics(pairs);
  }
  // Flagged emails the owner only "wants to know about": the cost of a false alarm.
  const flagged = rows.filter(x => predOf(x, 'important'));
  out.flagged_want_to_know_only = flagged.filter(x => !x.truth.important && x.truth.want_to_know).length;
  return out;
}

function printTable(title, m) {
  console.log(`\n${title}`);
  console.log('field                  n   recall  precision  accuracy   tp  fp  fn');
  for (const f of FIELDS) {
    const x = m[f];
    const p = v => (v === null ? '   -  ' : `${v.toFixed(1).padStart(5)}%`);
    console.log(`${f.padEnd(22)}${String(x.n).padStart(3)}  ${p(x.recall)}   ${p(x.precision)}    ${p(x.accuracy)}  ${String(x.tp).padStart(3)} ${String(x.fp).padStart(3)} ${String(x.fn).padStart(3)}`);
  }
  if (m.flagged_want_to_know_only !== undefined) console.log(`flagged but only "want to know": ${m.flagged_want_to_know_only}`);
}

async function datasetItems() {
  const items = [];
  for (let page = 1; ; page++) {
    const r = await lf('GET', `/api/public/dataset-items?datasetName=${encodeURIComponent(DATASET)}&limit=100&page=${page}`);
    items.push(...r.data);
    if (page >= r.meta.totalPages) break;
  }
  return items.filter(it => it.status === 'ACTIVE' && it.expectedOutput?.complete);
}

function oldSystem(ids) {
  if (!existsSync(OLD_DB)) return null;
  const old = new Database(OLD_DB, { readonly: true });
  const q = old.prepare('SELECT score FROM triage_results WHERE email_id = ?');
  const m = new Map(ids.map(id => [id, q.get(id)?.score]));
  old.close();
  return m;
}

const traceId = (run, emailId) => createHash('md5').update(`ecc-bt:${run}:${emailId}`).digest('hex');
const attr = (key, v) => ({ key, value: { stringValue: String(v) } });

async function sendTrace(run, meta, row) {
  const t = String(BigInt(Date.now()) * 1_000_000n);
  const id = traceId(run, row.email_id);
  const output = JSON.stringify(row.error ? { error: row.error } : row.pred);
  await lf('POST', '/api/public/otel/v1/traces', {
    resourceSpans: [{ resource: { attributes: [attr('service.name', 'ecc-backtest')] },
      scopeSpans: [{ scope: { name: 'ecc-backtest' }, spans: [{
        traceId: id, spanId: id.slice(0, 16), name: 'ecc-backtest', kind: 1, startTimeUnixNano: t, endTimeUnixNano: t,
        attributes: [
          attr('langfuse.trace.name', 'ecc-backtest'), attr('langfuse.environment', 'ecc-backtest'),
          attr('langfuse.trace.input', row.input), attr('langfuse.observation.input', row.input),
          attr('langfuse.trace.output', output), attr('langfuse.observation.output', output),
          attr('langfuse.trace.metadata.email_id', row.email_id), attr('langfuse.trace.metadata.run', run),
          attr('langfuse.trace.metadata.model', meta.model), attr('langfuse.trace.metadata.prompt', meta.prompt),
          // Langfuse v4 events-only: an experiment (dataset run) is declared on the span.
          attr('langfuse.experiment.id', meta.experiment_id), attr('langfuse.experiment.name', run),
          attr('langfuse.experiment.description', `${meta.prompt} · ${meta.model}`),
          attr('langfuse.experiment.metadata', JSON.stringify({ model: meta.model, prompt: meta.prompt })),
          attr('langfuse.experiment.dataset.id', meta.dataset_id), attr('langfuse.experiment.item.id', row.email_id),
          attr('langfuse.experiment.item.root_observation_id', id.slice(0, 16)),
          attr('langfuse.experiment.item.expected_output', JSON.stringify(row.truth)),
        ],
      }] }],
    }],
  });
  if (row.error) return;
  for (const f of FIELDS) {
    await lf('POST', '/api/public/scores', {
      traceId: id, name: `bt.${f}_match`, value: row.pred[f] === row.truth[f] ? 1 : 0, dataType: 'NUMERIC',
      environment: 'ecc-backtest', comment: `predicted ${row.pred[f]}, labelled ${row.truth[f]}`,
    });
  }
}

async function runBacktest(o) {
  const prompt = await getTextPrompt(IMPORTANCE_PROMPT_NAME, o.label, LOCAL_SYSTEM, { version: o.version });
  if (prompt.source !== 'langfuse') throw new Error(`prompt not from Langfuse: ${prompt.error}`);
  const promptName = promptLabel(prompt);
  const run = o.run || `${promptName.replace(' ', '-')}_${o.model}_${new Date().toISOString().slice(0, 16).replace(/[-:]/g, '')}`;
  let items = await datasetItems();
  if (o.limit) items = items.slice(0, o.limit);
  console.log(`run ${run}: ${items.length} labelled emails, ${promptName}, model ${o.model}`);

  const get = db.prepare(`SELECT id, account_id, uid, subject, sender_name, sender_email, recipients, date,
      snippet, body_text, message_id FROM emails WHERE id = ?`);
  const rows = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const it = items[next++];
      const email = get.get(it.id);
      const row = { email_id: it.id, stratum: it.metadata?.stratum, truth: it.expectedOutput, input: it.input.text };
      const t0 = Date.now();
      try {
        if (!email) throw new Error('email not in the database');
        // Same row the label set was built from (bodies are stored since #239).
        if (buildEmailMessage(email) !== it.input.text) row.input_changed = true;
        let ev;
        for (let attempt = 0; ; attempt++) {
          try {
            ev = await evaluateOne(email, prompt, { model: o.model, tags: ['ecc-backtest', `run:${run}`] });
            break;
          } catch (err) {
            if (attempt >= RETRIES || !/\b(429|500|502|503)\b/.test(err.message)) throw err;
            process.stdout.write('w');
            await sleep(RETRY_WAIT_MS);
          }
        }
        row.pred = { important: ev.important, ...Object.fromEntries(CRITERIA.map(c => [c, ev.criteria[c].answer])) };
        row.evidence_found = Object.fromEntries(CRITERIA.map(c => [c, ev.criteria[c].evidence_found]));
        row.why = ev.why;
      } catch (err) {
        row.error = err.message.slice(0, 300);
      }
      row.ms = Date.now() - t0;
      rows.push(row);
      process.stdout.write(row.error ? 'x' : '.');
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log('');

  const dataset = await lf('GET', `/api/public/v2/datasets/${encodeURIComponent(DATASET)}`);
  const meta = { model: o.model, prompt: promptName, prompt_version: prompt.version, dataset_id: dataset.id,
    experiment_id: createHash('md5').update(`ecc-bt:${run}`).digest('hex').slice(0, 25) };
  for (const row of rows) await sendTrace(run, meta, row);

  const ok = rows.filter(r => !r.error);
  const { dataset_id, experiment_id, ...shown } = meta;
  const result = {
    run, ...shown, experiment_id, at: new Date().toISOString(), n: rows.length, errors: rows.length - ok.length,
    metrics: report(ok, (x, f) => x.pred[f]),
    rows,
  };
  const old = oldSystem(ok.map(r => r.email_id));
  if (old) {
    result.old_system = report(ok, (x, f) => (f === 'important' ? (old.get(x.email_id) ?? 0) >= 50 : undefined));
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${run}.json`, JSON.stringify(result, null, 1));
  printTable(`${run} (${result.errors} errors)`, result.metrics);
  if (result.old_system) printTable('old system, score >= 50 (pre-#239)', result.old_system);
  console.log(`\nsaved ${OUT_DIR}/${run}.json; Langfuse: Datasets > ${DATASET} > Runs`);
}

/** Two runs on the same items: how often they agree, and how right each tier is. */
function compare([a, b]) {
  const load = n => JSON.parse(readFileSync(`${OUT_DIR}/${n}.json`, 'utf8'));
  const A = load(a), B = load(b);
  const bById = new Map(B.rows.filter(r => !r.error).map(r => [r.email_id, r]));
  const tiers = { sure: [], likely: [], doubtful: [] };
  for (const ra of A.rows.filter(r => !r.error)) {
    const rb = bById.get(ra.email_id);
    if (!rb) continue;
    const agree = ra.pred.important === rb.pred.important;
    const quoted = [ra, rb].every(r => CRITERIA.every(c => r.evidence_found[c] !== false));
    const tier = !agree ? 'doubtful' : quoted ? 'sure' : 'likely';
    tiers[tier].push({ ...ra, tier, right: ra.pred.important === ra.truth.important });
  }
  const n = Object.values(tiers).reduce((s, t) => s + t.length, 0);
  console.log(`\n${a}\n  vs ${b}: ${n} emails`);
  console.log('tier       emails  share   right (important)');
  for (const [k, t] of Object.entries(tiers)) {
    const right = t.filter(x => x.right).length;
    console.log(`${k.padEnd(10)}${String(t.length).padStart(6)}  ${(100 * t.length / (n || 1)).toFixed(0).padStart(4)}%   ${t.length ? (100 * right / t.length).toFixed(1) : '-'}%`);
  }
  const auto = [...tiers.sure, ...tiers.likely];
  printTable('decided automatically (sure + likely), run A answers', report(auto, (x, f) => x.pred[f]));
}

const o = args();
(o.compare ? Promise.resolve(compare(o.compare)) : runBacktest(o)).catch(err => { console.error(err); process.exit(1); });
