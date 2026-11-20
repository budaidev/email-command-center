/**
 * Points per signal (card #246 step 2/3): a logistic regression over the
 * deterministic signals, shown as points so every email's score can be taken
 * apart ("+25 payment keyword, -18 newsletter header ...").
 *
 * Scale: 10 points = 1 unit of log-odds. A score s means probability
 * 1 / (1 + e^(-s/10)) that the email is important: +30 ≈ 95%, -30 ≈ 5%.
 *
 * Learned from teacher labels (an LLM's verdicts on unlabelled mail, files in
 * /app/data/llm-checks/teacher-*.json), never from the owner's 70 labels: those
 * are the test set. The owner can override any feature's points in the UI.
 * Thresholds: score >= high is "important", <= low is "not important", in between
 * goes to the LLM. Only an active model is used by the pipeline.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import db from '../db.js';
import { SIGNALS_VERSION, domainCategoryOf } from './signals.js';
import { FIELDS } from './rules.js';

const TEACHER_DIR = '/app/data/llm-checks';
const SCALE = 10;
const PERSONAL_GITHUB = new Set(['mention', 'review_requested', 'assign', 'team_mention']);
const CATEGORIES = ['government', 'insurer', 'bank', 'utility', 'school', 'work', 'invoicing'];

/** The model's inputs: every yes/no signal plus a few derived ones. */
export const FEATURES = [
  ...FIELDS.filter(f => f.type === 'bool').map(f => ({ key: f.key, label: f.label })),
  ...CATEGORIES.map(c => ({ key: `domain:${c}`, label: `Domain-kategória: ${c}` })),
  { key: 'github_personal', label: 'GitHub: neked szól (review-kérés, említés)' },
  { key: 'github_other', label: 'GitHub: egyéb értesítés' },
  { key: 'many_recipients', label: 'Sok címzett (5-nél több)' },
];

/** Feature values (0/1) of one email from its stored signals. */
export function featuresOf(email, signals) {
  const domain = String(email.sender_email || '').toLowerCase().split('@')[1] || '';
  const cat = domainCategoryOf(domain);
  const x = {};
  for (const f of FEATURES) x[f.key] = 0;
  for (const f of FIELDS) if (f.type === 'bool' && signals[f.key] === true) x[f.key] = 1;
  if (cat && x[`domain:${cat}`] !== undefined) x[`domain:${cat}`] = 1;
  if (signals.github_reason) x[PERSONAL_GITHUB.has(signals.github_reason) ? 'github_personal' : 'github_other'] = 1;
  if ((signals.recipient_count || 0) > 5) x.many_recipients = 1;
  return x;
}

const sigmoid = z => 1 / (1 + Math.exp(-z));

/** Weighted L2-regularised logistic regression by gradient descent. */
function fit(rows, { l2 = 0.02, iters = 3000, lr = 0.5 } = {}) {
  const keys = FEATURES.map(f => f.key);
  const w = Object.fromEntries(keys.map(k => [k, 0]));
  let b = 0;
  const W = rows.reduce((s, r) => s + r.weight, 0);
  for (let it = 0; it < iters; it++) {
    const g = Object.fromEntries(keys.map(k => [k, 0]));
    let gb = 0;
    for (const r of rows) {
      let z = b;
      for (const k of keys) if (r.x[k]) z += w[k];
      const err = (sigmoid(z) - r.y) * r.weight;
      gb += err;
      for (const k of keys) if (r.x[k]) g[k] += err;
    }
    b -= (lr * gb) / W;
    for (const k of keys) w[k] -= lr * (g[k] / W + l2 * w[k]);
  }
  return { w, b };
}

function teacherRows() {
  if (!existsSync(TEACHER_DIR)) return { rows: [], sources: [] };
  const sources = readdirSync(TEACHER_DIR).filter(f => f.startsWith('teacher-') && f.endsWith('.json'));
  const meta = existsSync(`${TEACHER_DIR}/teacher-sample.json.meta`)
    ? new Map(JSON.parse(readFileSync(`${TEACHER_DIR}/teacher-sample.json.meta`, 'utf8')).map(m => [m.email_id, m]))
    : new Map();
  const labels = new Set(db.prepare('SELECT email_id FROM importance_labels').all().map(r => r.email_id));
  const get = db.prepare(`SELECT e.id, e.sender_email, s.signals FROM emails e
    JOIN email_signals s ON s.email_id = e.id AND s.version = ? WHERE e.id = ?`);
  const rows = [];
  for (const f of sources) {
    const d = JSON.parse(readFileSync(`${TEACHER_DIR}/${f}`, 'utf8'));
    for (const r of d.rows || d) {
      if (r.error || typeof r.important !== 'boolean' || labels.has(r.email_id)) continue;
      const e = get.get(SIGNALS_VERSION, r.email_id);
      if (!e) continue;
      // Sampling weight: the sample over-represents rule hits; weights restore the mailbox's mix.
      rows.push({ id: e.id, x: featuresOf(e, JSON.parse(e.signals)), y: r.important ? 1 : 0, weight: meta.get(r.email_id)?.weight || 1 });
    }
  }
  return { rows, sources };
}

// ─── Stored model ───

export function getModel() {
  const r = db.prepare('SELECT * FROM signal_score_model WHERE id = 1').get();
  if (!r) return null;
  return { ...r, features: JSON.parse(r.features), training: r.training ? JSON.parse(r.training) : null,
    last_backtest: r.last_backtest ? JSON.parse(r.last_backtest) : null };
}

/** Effective points of each feature: the owner's override, else the learned value. */
export function pointsOf(model) {
  return Object.fromEntries(Object.entries(model.features).map(([k, f]) => [k, f.override ?? f.learned]));
}

/** Learn the points from the teacher labels; keeps the owner's overrides and thresholds. */
export function train() {
  const { rows, sources } = teacherRows();
  if (rows.length < 200) throw Object.assign(new Error(`only ${rows.length} teacher labels; need at least 200`), { status: 400 });
  const { w, b } = fit(rows);
  const old = getModel();
  const features = {};
  for (const f of FEATURES) {
    features[f.key] = {
      learned: Math.round(w[f.key] * SCALE),
      override: old?.features?.[f.key]?.override ?? null,
      // How often the feature is on in the training data (weighted), for the UI.
      share: Math.round((1000 * rows.filter(r => r.x[f.key]).reduce((s, r) => s + r.weight, 0)) / rows.reduce((s, r) => s + r.weight, 0)) / 10,
    };
  }
  const training = { at: new Date().toISOString(), rows: rows.length, positives: rows.filter(r => r.y).length, sources };
  db.prepare(`INSERT INTO signal_score_model (id, intercept, features, high, low, status, training, last_backtest, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET intercept = excluded.intercept, features = excluded.features, training = excluded.training,
      last_backtest = NULL, status = CASE WHEN status = 'active' THEN 'draft' ELSE status END, updated_at = datetime('now')`)
    .run(Math.round(b * SCALE), JSON.stringify(features), old?.high ?? 30, old?.low ?? -30, old?.status ?? 'draft', JSON.stringify(training));
  return getModel();
}

/** Owner edits: overrides ({key: points|null}), intercept override, thresholds, status. */
export function updateModel({ overrides, high, low, status }) {
  const m = getModel();
  if (!m) throw Object.assign(new Error('no model yet: train first'), { status: 400 });
  const features = { ...m.features };
  let changed = false;
  for (const [k, v] of Object.entries(overrides || {})) {
    if (!features[k]) continue;
    const nv = v === null || v === '' ? null : Math.round(Number(v));
    if (nv !== null && Number.isNaN(nv)) continue;
    if (features[k].override !== nv) changed = true;
    features[k] = { ...features[k], override: nv };
  }
  const nh = high === undefined ? m.high : Math.round(Number(high));
  const nl = low === undefined ? m.low : Math.round(Number(low));
  if (nl >= nh) throw Object.assign(new Error('the low threshold must be below the high one'), { status: 400 });
  if (nh !== m.high || nl !== m.low) changed = true;
  let ns = status ?? m.status;
  if (ns === 'active' && m.status !== 'active' && (changed || !m.last_backtest)) {
    throw Object.assign(new Error('Élesítés előtt futtasd le a backtesztet pontosan erre a változatra.'), { status: 400 });
  }
  if (changed && ns === 'active') ns = 'draft';
  db.prepare(`UPDATE signal_score_model SET features = ?, high = ?, low = ?, status = ?,
      last_backtest = CASE WHEN ? THEN NULL ELSE last_backtest END, updated_at = datetime('now') WHERE id = 1`)
    .run(JSON.stringify(features), nh, nl, ns, changed ? 1 : 0);
  return getModel();
}

// ─── Scoring ───

/** { points, probability, verdict: 'important'|'not_important'|null, breakdown: [{key, label, points}] } */
export function scoreEmail(model, email, signals, points = pointsOf(model)) {
  const x = featuresOf(email, signals);
  const breakdown = [];
  let s = model.intercept;
  for (const f of FEATURES) {
    if (!x[f.key] || !points[f.key]) continue;
    s += points[f.key];
    breakdown.push({ key: f.key, label: f.label, points: points[f.key] });
  }
  breakdown.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  return {
    points: s,
    probability: Math.round(1000 * sigmoid(s / SCALE)) / 1000,
    verdict: s >= model.high ? 'important' : s <= model.low ? 'not_important' : null,
    breakdown,
  };
}

/** Scores for the pipeline: Map(id -> score) when the model is active, else empty. */
export function scoreForPipeline(emails) {
  const m = getModel();
  const out = new Map();
  if (!m || m.status !== 'active') return out;
  const points = pointsOf(m);
  for (const e of emails) if (e.signals) out.set(e.id, scoreEmail(m, e, e.signals, points));
  return out;
}

// ─── Backtest ───

/**
 * Against the owner's labels: important share per score band, and at the
 * thresholds how many emails are decided without the LLM and how many wrongly.
 * Coverage over all mail. Draft settings can be passed in without saving.
 */
export function backtest(draft = {}) {
  const m = getModel();
  if (!m) throw Object.assign(new Error('no model yet: train first'), { status: 400 });
  const model = { ...m, high: draft.high ?? m.high, low: draft.low ?? m.low };
  const points = { ...pointsOf(m) };
  for (const [k, v] of Object.entries(draft.overrides || {})) if (k in points) points[k] = v === null || v === '' ? m.features[k].learned : Number(v);

  const all = db.prepare(`SELECT e.id, e.subject, e.sender_email, e.date, s.signals FROM emails e
    JOIN email_signals s ON s.email_id = e.id AND s.version = ?`).all(SIGNALS_VERSION);
  const labels = new Map(db.prepare('SELECT email_id, important FROM importance_labels').all().map(r => [r.email_id, !!r.important]));
  const scored = all.map(e => ({ e, sc: scoreEmail(model, e, JSON.parse(e.signals), points) }));

  const bands = [[-Infinity, -30], [-30, -10], [-10, 10], [10, 30], [30, Infinity]].map(([lo, hi]) => {
    const inBand = scored.filter(x => x.sc.points > lo && x.sc.points <= hi);
    const lab = inBand.filter(x => labels.has(x.e.id));
    return { from: lo, to: hi, emails: inBand.length, labelled: lab.length, important: lab.filter(x => labels.get(x.e.id)).length };
  });
  const lab = scored.filter(x => labels.has(x.e.id));
  const decided = lab.filter(x => x.sc.verdict);
  const wrong = decided.filter(x => (x.sc.verdict === 'important') !== labels.get(x.e.id));
  const brief = x => ({ id: x.e.id, subject: x.e.subject, sender: x.e.sender_email, points: x.sc.points,
    labelled_important: labels.get(x.e.id), breakdown: x.sc.breakdown.slice(0, 6) });
  return {
    at: new Date().toISOString(), high: model.high, low: model.low,
    all: { total: scored.length, important: scored.filter(x => x.sc.verdict === 'important').length,
      not_important: scored.filter(x => x.sc.verdict === 'not_important').length },
    labelled: { total: lab.length, decided: decided.length, wrong: wrong.length,
      important_decided: decided.filter(x => x.sc.verdict === 'important').length,
      not_important_decided: decided.filter(x => x.sc.verdict === 'not_important').length },
    bands,
    wrong: wrong.map(brief),
    // Labelled emails in the LLM zone, closest to a threshold first: where tuning helps.
    near: lab.filter(x => !x.sc.verdict).sort((a, b) => Math.min(Math.abs(a.sc.points - model.high), Math.abs(a.sc.points - model.low))
      - Math.min(Math.abs(b.sc.points - model.high), Math.abs(b.sc.points - model.low))).slice(0, 10).map(brief),
  };
}

export function storeBacktest(result) {
  const { wrong, near, ...summary } = result;
  db.prepare('UPDATE signal_score_model SET last_backtest = ? WHERE id = 1').run(JSON.stringify(summary));
}

/** One email's breakdown (for the email view), with the current model whatever its status. */
export function explainEmail(emailId) {
  const m = getModel();
  if (!m) return null;
  const e = db.prepare(`SELECT e.id, e.sender_email, s.signals FROM emails e
    JOIN email_signals s ON s.email_id = e.id AND s.version = ? WHERE e.id = ?`).get(SIGNALS_VERSION, emailId);
  if (!e) return null;
  return { ...scoreEmail(m, e, JSON.parse(e.signals)), high: m.high, low: m.low, status: m.status };
}
