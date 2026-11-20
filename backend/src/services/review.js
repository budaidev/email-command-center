/**
 * The review list (card #242, "Átnézés"): what the owner still has to look at.
 *
 *   todo   - judged important (reply/decision, mandatory appointment, payment):
 *            becomes a GTD task in the Vikunja inbox, or is dismissed.
 *   know   - want to know, nothing to do (a want_to_know rule, or the LLM once the
 *            prompt asks): marked seen, or turned into a task after all.
 *   unsure - the LLM and the signal score disagree: the owner decides either way.
 *
 * Only emails evaluated by the new pipeline (prompt_version set) are listed, and
 * each leaves the lists once it has a decision or is linked to a task. The
 * decisions are kept (email_review) so they can later serve as labels.
 */

import db from '../db.js';
import { createTask } from './vikunja.js';

const APP_URL = process.env.APP_URL || 'https://email.home.budai.dev';
// Points (signal score) beyond which the score clearly contradicts the LLM.
const DISAGREE = 10;
const UNSURE_LIMIT = 15;

const BASE = `FROM triage_results t
  JOIN emails e ON e.id = t.email_id
  LEFT JOIN email_review r ON r.email_id = t.email_id
  WHERE r.email_id IS NULL AND e.gtd_task_id IS NULL
    AND t.status = 'evaluated' AND t.prompt_version IS NOT NULL AND t.important IS NOT NULL`;

const POINTS = `json_extract(t.criteria, '$.score.points')`;
// Decided by the LLM (not by a rule or the score alone) and contradicted by the score.
const UNSURE = `t.model NOT IN ('rules', 'signal-score') AND ${POINTS} IS NOT NULL
  AND ((t.important = 1 AND ${POINTS} <= -${DISAGREE}) OR (t.important = 0 AND ${POINTS} >= ${DISAGREE}))`;

const WHERE = {
  todo: `t.important = 1 AND NOT (${UNSURE})`,
  know: `t.important = 0 AND t.want_to_know = 1`,
  unsure: UNSURE,
};
export const LISTS = Object.keys(WHERE);

export function counts() {
  const out = {};
  for (const [k, w] of Object.entries(WHERE)) {
    const n = db.prepare(`SELECT count(*) AS n ${BASE} AND (${w})`).get().n;
    out[k] = k === 'unsure' ? Math.min(n, UNSURE_LIMIT) : n;
  }
  out.decided = db.prepare('SELECT decision, count(*) AS n FROM email_review GROUP BY decision').all()
    .reduce((a, r) => ({ ...a, [r.decision]: r.n }), {});
  return out;
}

export function list(name, { limit = 100 } = {}) {
  if (!WHERE[name]) throw Object.assign(new Error(`unknown list ${name}`), { status: 400 });
  const n = name === 'unsure' ? UNSURE_LIMIT : Math.min(Number(limit) || 100, 500);
  const rows = db.prepare(`SELECT e.id, e.subject, e.sender_name, e.sender_email, e.date, e.snippet,
      t.important, t.want_to_know, t.reason, t.suggested_task, t.action_type, t.model, t.prompt_version, t.criteria
    ${BASE} AND (${WHERE[name]}) ORDER BY e.date DESC LIMIT ?`).all(n);
  return rows.map(r => {
    let c = {};
    try { c = JSON.parse(r.criteria || '{}'); } catch { /* keep empty */ }
    const evidence = Object.entries(c)
      .filter(([, v]) => v && typeof v === 'object' && v.answer === true)
      .map(([k, v]) => ({ criterion: k, quote: v.evidence, found: v.evidence_found }));
    return {
      id: r.id, subject: r.subject, sender_name: r.sender_name, sender_email: r.sender_email, date: r.date, snippet: r.snippet,
      important: !!r.important, want_to_know: r.want_to_know === null ? null : !!r.want_to_know,
      why: r.reason, suggested_task: r.suggested_task, action_type: r.action_type, kind: c.kind || null,
      decided_by: r.model === 'rules' ? 'rule' : r.model === 'signal-score' ? 'score' : 'llm',
      prompt_version: r.prompt_version, model: r.model,
      score: c.score ? { points: c.score.points, probability: c.score.probability, breakdown: (c.score.breakdown || []).slice(0, 5) } : null,
      evidence,
    };
  });
}

const insert = db.prepare(`INSERT INTO email_review (email_id, list, decision, task_id) VALUES (?, ?, ?, ?)
  ON CONFLICT(email_id) DO UPDATE SET list = excluded.list, decision = excluded.decision, task_id = excluded.task_id, decided_at = datetime('now')`);

/** decision: todo (needs title; creates the Vikunja task) | dismissed | seen. */
export async function decide(emailId, { list: from, decision, title, due }) {
  if (!['todo', 'dismissed', 'seen'].includes(decision)) throw Object.assign(new Error('decision must be todo, dismissed or seen'), { status: 400 });
  const email = db.prepare('SELECT id, subject, sender_name, sender_email, date, gtd_task_id FROM emails WHERE id = ?').get(emailId);
  if (!email) throw Object.assign(new Error('Email not found'), { status: 404 });
  let taskId = null;
  if (decision === 'todo') {
    if (email.gtd_task_id) throw Object.assign(new Error('Ehhez a levélhez már van feladat'), { status: 409 });
    if (!String(title || '').trim()) throw Object.assign(new Error('A feladatnak kell cím'), { status: 400 });
    const why = db.prepare('SELECT reason FROM triage_results WHERE email_id = ?').get(emailId)?.reason;
    const notes = [
      `Levél: ${email.subject}`,
      `Feladó: ${email.sender_name || ''} <${email.sender_email}>`,
      `Dátum: ${email.date}`,
      why ? `Miért: ${why}` : null,
      `${APP_URL}/email/${email.id}`,
    ].filter(Boolean).join('\n');
    const task = await createTask({ title: String(title).trim(), notes, due: due || undefined, col: 'inbox' });
    taskId = String(task.id);
    db.prepare('UPDATE emails SET gtd_task_id = ? WHERE id = ?').run(taskId, emailId);
  }
  insert.run(emailId, from || 'todo', decision, taskId);
  return { email_id: emailId, decision, task_id: taskId };
}

/** Put an email back on the lists. A created Vikunja task stays (delete it there). */
export function undo(emailId) {
  db.prepare('DELETE FROM email_review WHERE email_id = ?').run(emailId);
  return { email_id: emailId };
}
