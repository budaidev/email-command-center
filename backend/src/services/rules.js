/**
 * Decision rules (card #247): conditions over the deterministic signals
 * (services/signals.js) that decide an email's importance without, or on top of,
 * the LLM. Edited, backtested and activated in Triage > Workbench.
 *
 * A rule: { name, conditions: [{field, op, value}] (all must hold), verdict,
 * status }. verdict "not_important": the LLM is not called. verdict "want_to_know":
 * not important either (no LLM), but listed under "Tudni akarom" for review. verdict "important":
 * the LLM still runs (for the why and the task), its verdict is overridden.
 * Only status "active" rules run in the pipeline; the first match by sort_order wins.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { SIGNALS_VERSION, domainCategoryOf } from './signals.js';
import { langfuseApi } from './langfuse.js';

const BACKTEST_DIR = '/app/data/backtests';
const LLM_CHECK_DIR = '/app/data/llm-checks';
const DATASET = 'ecc-importance-labels';

// ─── Fields and operators ───

const BOOL = 'bool', STR = 'string', NUM = 'number';
export const FIELDS = [
  ['list_unsubscribe', BOOL, 'Hírlevél-fejléc: List-Unsubscribe'],
  ['list_id', BOOL, 'Levelezőlista: List-Id'],
  ['precedence_bulk', BOOL, 'Precedence: bulk/list'],
  ['esp_feedback_id', BOOL, 'Tömeges küldő nyoma (Feedback-ID stb.)'],
  ['auto_submitted', BOOL, 'Automatikus levél (Auto-Submitted)'],
  ['noreply_sender', BOOL, 'noreply / notifications feladó'],
  ['role_sender', BOOL, 'Szerepkör-cím (info@, support@ …)'],
  ['unsubscribe_text', BOOL, 'Leiratkozás / hírlevél szöveg'],
  ['freemail_sender', BOOL, 'Magáncímről írt (gmail, freemail …)'],
  ['owner_in_to', BOOL, 'Te vagy a címzett (To)'],
  ['owner_in_cc_only', BOOL, 'Csak másolatban kaptad'],
  ['from_owner', BOOL, 'Te küldted'],
  ['is_reply', BOOL, 'Válasz (Re:)'],
  ['is_forward', BOOL, 'Továbbított (Fwd:)'],
  ['kw_payment', BOOL, 'Kulcsszó: fizetés'],
  ['kw_receipt', BOOL, 'Kulcsszó: nyugta / visszaigazolás'],
  ['kw_deadline', BOOL, 'Kulcsszó: határidő'],
  ['kw_appointment', BOOL, 'Kulcsszó: időpont / találkozó'],
  ['kw_reply_request', BOOL, 'Választ kér / kérdez'],
  ['kw_security', BOOL, 'Biztonsági riasztás (új belépés, eszköz …)'],
  ['kw_verification_code', BOOL, 'Ellenőrző / egyszeri kód'],
  ['att_pdf', BOOL, 'PDF csatolmány'],
  ['att_calendar', BOOL, 'Naptármeghívó csatolmány'],
  ['att_invoice', BOOL, 'Számla-csatolmány (fájlnév)'],
  ['owner_wrote_to_sender_before', BOOL, 'Írtál már a feladónak (korábban)'],
  ['owner_replied_in_thread_before', BOOL, 'Válaszoltál már ebben a szálban'],
  ['domain_category', STR, 'Feladó domain-kategóriája'],
  ['sender_domain', STR, 'Feladó domainje'],
  ['sender_email', STR, 'Feladó címe'],
  ['subject', STR, 'Tárgy'],
  ['github_reason', STR, 'GitHub: miért kaptad (X-GitHub-Reason)'],
  ['github_repo', STR, 'GitHub: repó (tárgyból, pl. apache/fineract)'],
  ['list_id_value', STR, 'Levelezőlista azonosítója (List-Id)'],
  ['recipient_count', NUM, 'Címzettek száma (To+Cc)'],
  ['any_of', 'boolset', 'Bármelyik igaz ezek közül…'],
].map(([key, type, label]) => ({ key, type, label }));

export const OPS = {
  bool: ['is_true', 'is_false'],
  string: ['equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'matches', 'is_empty', 'not_empty'],
  number: ['gt', 'lt', 'equals'],
  boolset: ['any_true', 'none_true'], // value: comma-separated bool field keys
};
export const VERDICTS = ['not_important', 'want_to_know', 'important'];
const FIELD = new Map(FIELDS.map(f => [f.key, f]));

/** Values a rule sees: the stored signals, email fields, and the live domain category. */
function contextOf(email, signals) {
  return {
    ...signals,
    sender_email: String(email.sender_email || '').toLowerCase(),
    sender_domain: String(email.sender_email || '').toLowerCase().split('@')[1] || '',
    subject: String(email.subject || ''),
    domain_category: domainCategoryOf(String(email.sender_email || '').toLowerCase().split('@')[1] || ''),
  };
}

const list = v => String(v ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function test(cond, ctx) {
  const v = ctx[cond.field];
  const s = String(v ?? '').toLowerCase();
  switch (cond.op) {
    case 'any_true': return list(cond.value).some(k => ctx[k] === true);
    case 'none_true': return !list(cond.value).some(k => ctx[k] === true);
    case 'is_true': return v === true;
    case 'is_false': return v !== true; // unknown (null) counts as false
    case 'equals': return FIELD.get(cond.field)?.type === NUM ? Number(v) === Number(cond.value) : s === String(cond.value ?? '').toLowerCase();
    case 'not_equals': return s !== String(cond.value ?? '').toLowerCase();
    case 'in': return list(cond.value).includes(s);
    case 'not_in': return !list(cond.value).includes(s);
    case 'contains': return s.includes(String(cond.value ?? '').toLowerCase());
    case 'not_contains': return !s.includes(String(cond.value ?? '').toLowerCase());
    case 'matches': try { return new RegExp(cond.value, 'i').test(String(v ?? '')); } catch { return false; }
    case 'is_empty': return v === null || v === undefined || v === '';
    case 'not_empty': return !(v === null || v === undefined || v === '');
    case 'gt': return Number(v) > Number(cond.value);
    case 'lt': return Number(v) < Number(cond.value);
    default: return false;
  }
}

/** Problems with a rule definition, or [] when it is valid. */
export function validateRule(r) {
  const errs = [];
  if (!String(r.name || '').trim()) errs.push('name is required');
  if (!VERDICTS.includes(r.verdict)) errs.push(`verdict must be one of ${VERDICTS.join(', ')}`);
  if (!Array.isArray(r.conditions) || r.conditions.length === 0) errs.push('at least one condition is required');
  for (const [i, c] of (r.conditions || []).entries()) {
    const f = FIELD.get(c.field);
    if (!f) { errs.push(`condition ${i + 1}: unknown field ${c.field}`); continue; }
    if (!OPS[f.type].includes(c.op)) errs.push(`condition ${i + 1}: operator ${c.op} does not fit ${f.type} field ${c.field}`);
    if (f.type === 'boolset') {
      const keys = list(c.value);
      if (!keys.length) errs.push(`condition ${i + 1}: pick at least one field`);
      for (const k of keys) if (FIELD.get(k)?.type !== BOOL) errs.push(`condition ${i + 1}: ${k} is not a yes/no field`);
    }
    if (c.op === 'matches') { try { new RegExp(c.value); } catch { errs.push(`condition ${i + 1}: invalid regex`); } }
  }
  return errs;
}

export const matches = (rule, ctx) => rule.conditions.every(c => test(c, ctx));

// ─── Storage ───

const parseRule = r => r && ({ ...r, conditions: JSON.parse(r.conditions || '[]'), last_backtest: r.last_backtest ? JSON.parse(r.last_backtest) : null });

export function listRules() {
  return db.prepare('SELECT * FROM decision_rules ORDER BY sort_order, created_at').all().map(parseRule);
}
export function getRule(id) {
  return parseRule(db.prepare('SELECT * FROM decision_rules WHERE id = ?').get(id));
}
export function saveRule(r) {
  const id = r.id || uuidv4();
  db.prepare(`INSERT INTO decision_rules (id, name, conditions, verdict, status, note, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, conditions = excluded.conditions, verdict = excluded.verdict,
      status = excluded.status, note = excluded.note, sort_order = excluded.sort_order, updated_at = datetime('now')`)
    .run(id, r.name.trim(), JSON.stringify(r.conditions), r.verdict, r.status || 'draft', r.note || null, r.sort_order ?? 0);
  return getRule(id);
}
export function deleteRule(id) {
  db.prepare('DELETE FROM decision_rules WHERE id = ?').run(id);
}

// ─── Pipeline ───

/** First active rule matching each email: Map(email id -> rule). Emails need .signals. */
export function decideByRules(emails) {
  const active = listRules().filter(r => r.status === 'active');
  const out = new Map();
  if (!active.length) return out;
  for (const e of emails) {
    if (!e.signals) continue; // no signals: never decide blind
    const ctx = contextOf(e, e.signals);
    const hit = active.find(r => matches(r, ctx));
    if (hit) out.set(e.id, hit);
  }
  return out;
}

// ─── Labels ───

/** Copy the owner's complete labels from the Langfuse dataset into importance_labels. */
export async function syncLabels() {
  const items = [];
  for (let page = 1; ; page++) {
    const r = await langfuseApi('GET', `/api/public/dataset-items?datasetName=${DATASET}&limit=100&page=${page}`);
    items.push(...r.data);
    if (page >= r.meta.totalPages) break;
  }
  const good = items.filter(it => it.status === 'ACTIVE' && it.expectedOutput?.complete);
  db.transaction(() => {
    db.prepare('DELETE FROM importance_labels').run();
    const ins = db.prepare('INSERT INTO importance_labels (email_id, important, want_to_know, labels, stratum) VALUES (?, ?, ?, ?, ?)');
    for (const it of good) {
      const l = it.expectedOutput;
      ins.run(it.id, l.important ? 1 : 0, l.want_to_know === undefined ? null : (l.want_to_know ? 1 : 0), JSON.stringify(l), it.metadata?.stratum || null);
    }
  })();
  return labelStatus();
}

export function labelStatus() {
  return db.prepare('SELECT count(*) AS n, sum(important) AS important, max(synced_at) AS synced_at FROM importance_labels').get();
}

// ─── Backtest ───

/** LLM verdicts to compare a rule with: Map(email id -> [{source, important, why}]). */
function llmOpinions() {
  const out = new Map();
  const add = (id, o) => { if (!out.has(id)) out.set(id, []); out.get(id).push(o); };
  for (const dir of [BACKTEST_DIR, LLM_CHECK_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
        const model = d.model || f.replace(/\.json$/, '');
        for (const r of d.rows || d) {
          const imp = r.pred ? r.pred.important : r.important;
          if (r.error || typeof imp !== 'boolean') continue;
          add(r.email_id, { source: model, important: imp, why: r.why || null });
        }
      } catch { /* a broken file is skipped */ }
    }
  }
  const prod = db.prepare(`SELECT email_id, important, model, reason FROM triage_results
    WHERE important IS NOT NULL AND status = 'evaluated' AND prompt_version LIKE 'ecc-importance%'`).all();
  for (const r of prod) add(r.email_id, { source: `${r.model} (élő)`, important: !!r.important, why: r.reason });
  return out;
}

/**
 * Run a rule (saved or draft) over every email with current signals.
 * Returns fires and errors on the owner's labels (with the wrong emails),
 * coverage of all mail, disagreement with each LLM source, and a sample of hits.
 */
export function backtestRule(rule) {
  const errs = validateRule(rule);
  if (errs.length) throw Object.assign(new Error(errs.join('; ')), { status: 400 });
  const verdict = rule.verdict === 'important';
  const rows = db.prepare(`SELECT e.id, e.subject, e.sender_email, e.sender_name, e.date, s.signals
    FROM emails e JOIN email_signals s ON s.email_id = e.id AND s.version = ?`).all(SIGNALS_VERSION);
  const labels = new Map(db.prepare('SELECT email_id, important, want_to_know FROM importance_labels').all().map(r => [r.email_id, r]));
  const opinions = llmOpinions();
  const brief = e => ({ id: e.id, subject: e.subject, sender: e.sender_email, date: e.date });

  const fired = [];
  for (const e of rows) {
    if (matches(rule, contextOf(e, JSON.parse(e.signals)))) fired.push(e);
  }
  const firedLabelled = fired.filter(e => labels.has(e.id));
  const wrong = firedLabelled.filter(e => !!labels.get(e.id).important !== verdict)
    .map(e => ({ ...brief(e), labelled_important: !!labels.get(e.id).important, want_to_know: !!labels.get(e.id).want_to_know }));
  // Labelled emails of the verdict's class the rule does not catch (what is left to the LLM).
  const labelledOfClass = [...labels.values()].filter(l => !!l.important === verdict).length;

  const bySource = new Map();
  for (const e of fired) {
    for (const o of opinions.get(e.id) || []) {
      if (!bySource.has(o.source)) bySource.set(o.source, { source: o.source, evaluated: 0, disagree: 0, examples: [] });
      const s = bySource.get(o.source);
      s.evaluated++;
      if (o.important !== verdict) {
        s.disagree++;
        if (s.examples.length < 20) s.examples.push({ ...brief(e), why: o.why });
      }
    }
  }
  // A stable pseudo-random sample of hits outside the labels, to read through.
  const sample = fired.filter(e => !labels.has(e.id))
    .map(e => [parseInt(e.id.replace(/-/g, '').slice(0, 8), 16), e]).sort((a, b) => a[0] - b[0]).slice(0, 15).map(([, e]) => brief(e));

  return {
    at: new Date().toISOString(),
    verdict: rule.verdict,
    total_emails: rows.length,
    fires: fired.length,
    coverage_pct: rows.length ? Math.round((1000 * fired.length) / rows.length) / 10 : 0,
    labelled: { total: labels.size, fires: firedLabelled.length, wrong: wrong.length, of_class: labelledOfClass,
      // How many of the fired, labelled emails the owner marked "want to know" (the aim of a want_to_know rule).
      want_to_know: firedLabelled.filter(e => labels.get(e.id).want_to_know).length,
      caught_pct: labelledOfClass ? Math.round((1000 * (firedLabelled.length - wrong.length)) / labelledOfClass) / 10 : null },
    wrong,
    llm: [...bySource.values()].sort((a, b) => b.evaluated - a.evaluated),
    sample,
  };
}

export function storeBacktest(id, result) {
  const { wrong, llm, sample, ...summary } = result;
  db.prepare('UPDATE decision_rules SET last_backtest = ? WHERE id = ?').run(JSON.stringify({
    ...summary, llm: llm.map(({ examples, ...s }) => s),
  }), id);
}
