/**
 * The review list (card #242, "Átnézés"): what the owner still has to look at.
 *
 *   todo   - judged important (reply/decision, mandatory appointment, payment):
 *            becomes a GTD task in the Vikunja inbox, or is dismissed.
 *   know   - want to know, nothing to do (a want_to_know rule, or the LLM once the
 *            prompt asks): marked seen, or turned into a task after all.
 *   unsure - the LLM and the signal score disagree: the owner decides either way.
 *   fineract - everything about Apache Fineract (dev list, GitHub, Jira), kept out
 *            of the three lists above and handled on its own: by default the
 *            important and unsure ones, with all=1 every undecided one.
 *
 * Only emails evaluated by the new pipeline (prompt_version set) are listed, and
 * each leaves the lists once it has a decision or is linked to a task. The
 * decisions are kept (email_review) so they can later serve as labels.
 */

import db from '../db.js';
import { createTask } from './vikunja.js';
import { guessDue } from './due.js';

const APP_URL = process.env.APP_URL || 'https://email.home.budai.dev';
// Points (signal score) beyond which the score clearly contradicts the LLM.
const DISAGREE = 10;
const UNSURE_LIMIT = 15;

const BASE = `FROM triage_results t
  JOIN emails e ON e.id = t.email_id
  LEFT JOIN email_review r ON r.email_id = t.email_id
  LEFT JOIN email_signals s ON s.email_id = t.email_id
  WHERE r.email_id IS NULL AND e.gtd_task_id IS NULL
    AND t.status = 'evaluated' AND t.prompt_version IS NOT NULL AND t.important IS NOT NULL`;

const POINTS = `json_extract(t.criteria, '$.score.points')`;
// Decided by the LLM (not by a rule or the score alone) and contradicted by the score.
const UNSURE = `t.model NOT IN ('rules', 'signal-score') AND ${POINTS} IS NOT NULL
  AND ((t.important = 1 AND ${POINTS} <= -${DISAGREE}) OR (t.important = 0 AND ${POINTS} >= ${DISAGREE}))`;

// Fineract mail: by subject, sender, mailing list or GitHub repo. coalesce: a NULL
// would make NOT (...) NULL and drop the email from every list.
const FINERACT = `(lower(e.subject) LIKE '%fineract%' OR lower(e.sender_email) LIKE '%fineract%'
  OR coalesce(json_extract(s.signals, '$.list_id_value'), '') LIKE '%fineract%' OR coalesce(json_extract(s.signals, '$.github_repo'), '') LIKE '%fineract%')`;

const WHERE = {
  todo: `t.important = 1 AND NOT (${UNSURE}) AND NOT ${FINERACT}`,
  know: `t.important = 0 AND t.want_to_know = 1 AND NOT ${FINERACT}`,
  unsure: `(${UNSURE}) AND NOT ${FINERACT}`,
  fineract: `${FINERACT} AND (t.important = 1 OR t.want_to_know = 1 OR (${UNSURE}))`,
};
const ALL = { fineract: FINERACT };
export const LISTS = Object.keys(WHERE);

export function counts() {
  const out = {};
  for (const [k, w] of Object.entries(WHERE)) {
    const n = db.prepare(`SELECT count(*) AS n ${BASE} AND (${w})`).get().n;
    out[k] = k === 'unsure' ? Math.min(n, UNSURE_LIMIT) : n;
  }
  out.fineract_all = db.prepare(`SELECT count(*) AS n ${BASE} AND ${FINERACT}`).get().n;
  out.decided = db.prepare('SELECT decision, count(*) AS n FROM email_review GROUP BY decision').all()
    .reduce((a, r) => ({ ...a, [r.decision]: r.n }), {});
  return out;
}

export function list(name, { limit = 100, all = false } = {}) {
  if (!WHERE[name]) throw Object.assign(new Error(`unknown list ${name}`), { status: 400 });
  const n = name === 'unsure' ? UNSURE_LIMIT : Math.min(Number(limit) || 100, 500);
  const where = all && ALL[name] ? ALL[name] : WHERE[name];
  const rows = db.prepare(`SELECT e.id, e.subject, e.sender_name, e.sender_email, e.date, e.snippet, e.body_text,
      t.important, t.want_to_know, t.reason, t.suggested_task, t.action_type, t.model, t.prompt_version, t.criteria
    ${BASE} AND (${where}) ORDER BY e.date DESC LIMIT ?`).all(n);
  return rows.map(r => {
    let c = {};
    try { c = JSON.parse(r.criteria || '{}'); } catch { /* keep empty */ }
    const evidence = Object.entries(c)
      .filter(([, v]) => v && typeof v === 'object' && v.answer === true)
      .map(([k, v]) => ({ criterion: k, quote: v.evidence, found: v.evidence_found }));
    return {
      id: r.id, subject: r.subject, sender_name: r.sender_name, sender_email: r.sender_email, date: r.date, snippet: r.snippet,
      important: !!r.important, want_to_know: r.want_to_know === null ? null : !!r.want_to_know,
      // Deadline read from the email (no LLM), to prefill the task's due date.
      // The LLM's date (prompt v2) first, else the pattern match on the text.
      due_guess: r.important ? (c.due || guessDue(`${r.subject || ''}\n${r.body_text || r.snippet || ''}`, r.date)) : null,
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
    // Vikunja descriptions are HTML: escape, and make the link back clickable.
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const url = `${APP_URL}/email/${email.id}`;
    const notes = [
      `<p><b>Levél:</b> ${esc(email.subject)}</p>`,
      `<p><b>Feladó:</b> ${esc(email.sender_name || '')} (${esc(email.sender_email)})</p>`,
      `<p><b>Dátum:</b> ${esc(email.date)}</p>`,
      why ? `<p><b>Miért:</b> ${esc(why)}</p>` : null,
      `<p><a href="${url}">Levél megnyitása</a></p>`,
    ].filter(Boolean).join('');
    const task = await createTask({ title: String(title).trim(), notes, due: due || undefined, col: 'inbox' });
    taskId = String(task.id);
    db.prepare('UPDATE emails SET gtd_task_id = ? WHERE id = ?').run(taskId, emailId);
  }
  insert.run(emailId, from || 'todo', decision, taskId);
  return { email_id: emailId, decision, task_id: taskId };
}

/** The same decision (seen or dismissed) for many emails at once, e.g. a list's whole page. */
export function decideMany(ids, { list: from, decision }) {
  if (!['dismissed', 'seen'].includes(decision)) throw Object.assign(new Error('bulk decision must be dismissed or seen'), { status: 400 });
  if (!Array.isArray(ids) || !ids.length) throw Object.assign(new Error('ids required'), { status: 400 });
  db.transaction(() => { for (const id of ids) insert.run(id, from || 'todo', decision, null); })();
  return { ids, decision };
}

export function undoMany(ids) {
  const del = db.prepare('DELETE FROM email_review WHERE email_id = ?');
  db.transaction(() => { for (const id of ids) del.run(id); })();
  return { ids };
}

/** Put an email back on the lists. A created Vikunja task stays (delete it there). */
export function undo(emailId) {
  db.prepare('DELETE FROM email_review WHERE email_id = ?').run(emailId);
  return { email_id: emailId };
}
