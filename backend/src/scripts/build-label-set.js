/**
 * Card #240 (2026-11-19): put a chosen set of emails into Langfuse for labelling.
 *
 *   docker cp label_set.json email-command-center-backend:/tmp/label_set.json
 *   docker exec email-command-center-backend node --env-file=/app/.env src/scripts/build-label-set.js /tmp/label_set.json
 *
 * label_set.json: [{ email_id, stratum }]. For each email (bodies fetched from the
 * local mailserver when missing):
 *  - a trace "ecc-label" in environment "ecc-labels" whose input is exactly what
 *    the rubric model sees, and nothing else: no model answer, no selection
 *    stratum, so the labels are not biased by them. Trace id = md5(email id).
 *  - an item in dataset DATASET (id = email id, stratum in metadata). Datasets
 *    live in Postgres and survive the 30-day trace cleanup; labels are copied
 *    into the items with sync-labels.js.
 * Then the score configs (BOOLEAN) and the annotation queue holding the traces.
 * Safe to re-run: ids are deterministic, existing configs and queue are reused.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import db from '../db.js';
import { ensureBodies } from '../services/importance.js';
import { buildEmailMessage } from '../prompts/importance.js';

export const DATASET = 'ecc-importance-labels';
export const QUEUE = 'ECC fontosság címkézés';
export const SCORES = [
  ['ecc.reply_or_decision', 'Választ vagy döntést vár tőled a levél (személyesen tőled, nem körlevél).'],
  ['ecc.mandatory_appointment', 'Kötelező időpont: olyan időpontot rögzít, javasol, módosít vagy töröl, amelyen ott kell lenned, vagy amit vissza kell igazolnod.'],
  ['ecc.payment_due', 'Fizetned kell valamit (számla, díj, bírság, adó, lejárt tartozás). Már kifizetett nyugta vagy automatikus levonás: nem.'],
  ['ecc.important', 'Összességében fontos-e neked ez a levél. Akkor is igen lehet, ha a fenti három egyike sem igaz; ilyenkor írd meg megjegyzésben, miért.'],
];

const HOST = process.env.LANGFUSE_HOST;
const AUTH = 'Basic ' + Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64');

export async function lf(method, path, body) {
  const res = await fetch(`${HOST}${path}`, {
    method, headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export const traceIdOf = emailId => createHash('md5').update(`ecc-label:${emailId}`).digest('hex');

async function main() {
  const set = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const stratum = new Map(set.map(x => [x.email_id, x.stratum]));
  const ids = [...stratum.keys()];
  const emails = db.prepare(`SELECT id, account_id, uid, subject, sender_name, sender_email, recipients, date,
      snippet, body_text, message_id FROM emails WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  console.log(`${emails.length} of ${ids.length} emails found; fetching missing bodies...`);
  await ensureBodies(emails);
  console.log(`${emails.filter(e => e.body_text && e.body_text.trim()).length} have a body`);

  // 1. Traces over OTLP/HTTP JSON (Langfuse v4 is events-only).
  const attr = (key, v) => ({ key, value: { stringValue: String(v) } });
  for (let i = 0; i < emails.length; i += 50) {
    const spans = emails.slice(i, i + 50).map(e => {
      // Now, not the mail's date: the 30-day trace cleanup keys on start time.
      const t = BigInt(Date.now()) * 1_000_000n;
      const input = buildEmailMessage(e);
      return {
        traceId: traceIdOf(e.id), spanId: traceIdOf(e.id).slice(0, 16), name: 'ecc-label', kind: 1,
        startTimeUnixNano: String(t), endTimeUnixNano: String(t),
        attributes: [
          attr('langfuse.trace.name', 'ecc-label'), attr('langfuse.environment', 'ecc-labels'),
          attr('langfuse.trace.input', input), attr('langfuse.observation.input', input),
          attr('langfuse.trace.metadata.email_id', e.id),
        ],
      };
    });
    await lf('POST', '/api/public/otel/v1/traces', {
      resourceSpans: [{ resource: { attributes: [attr('service.name', 'ecc-labels')] },
        scopeSpans: [{ scope: { name: 'ecc-labels' }, spans }] }],
    });
  }
  console.log(`${emails.length} traces sent`);

  // 2. Dataset + items.
  try {
    await lf('POST', '/api/public/v2/datasets', { name: DATASET,
      description: 'ECC importance: emails labelled by the owner (card #240). Personal data, tailnet only.' });
  } catch (err) { if (!/already exists|409|Unique/i.test(err.message)) throw err; }
  for (const e of emails) {
    await lf('POST', '/api/public/dataset-items', {
      datasetName: DATASET, id: e.id, sourceTraceId: traceIdOf(e.id),
      input: { email_id: e.id, message_id: e.message_id, text: buildEmailMessage(e) },
      metadata: { stratum: stratum.get(e.id), date: e.date },
    });
  }
  console.log(`dataset ${DATASET}: ${emails.length} items`);

  // 3. Score configs.
  const existing = (await lf('GET', '/api/public/score-configs?limit=100')).data;
  const configIds = [];
  for (const [name, description] of SCORES) {
    let c = existing.find(x => x.name === name && !x.isArchived);
    if (!c) c = await lf('POST', '/api/public/score-configs', { name, dataType: 'BOOLEAN', description });
    configIds.push(c.id);
  }

  // 4. Annotation queue + items.
  let queue = (await lf('GET', '/api/public/annotation-queues?limit=100')).data.find(q => q.name === QUEUE);
  if (!queue) queue = await lf('POST', '/api/public/annotation-queues', { name: QUEUE,
    description: 'Olvasd el a levelet, és jelöld be a négy igen/nem kérdést. Ha valami fontos, de egyik szempont sem illik rá, írd meg megjegyzésben.',
    scoreConfigIds: configIds });
  const have = new Set();
  for (let page = 1; ; page++) {
    const r = await lf('GET', `/api/public/annotation-queues/${queue.id}/items?limit=100&page=${page}`);
    r.data.forEach(it => have.add(it.objectId));
    if (page >= (r.meta?.totalPages || 1)) break;
  }
  let added = 0;
  for (const e of emails) {
    if (have.has(traceIdOf(e.id))) continue;
    await lf('POST', `/api/public/annotation-queues/${queue.id}/items`, { objectId: traceIdOf(e.id), objectType: 'TRACE' });
    added++;
  }
  console.log(`queue "${QUEUE}" (${queue.id}): ${added} items added, ${have.size} were there`);
}

if (process.argv[1]?.endsWith('build-label-set.js')) main().catch(err => { console.error(err); process.exit(1); });
