/**
 * The owner's corrections ("Rossz besorolás"): the right verdict for an email,
 * with an optional note, from the review list or the reading view. Together with
 * the review decisions they are the fresh labels for measuring the live prompt.
 *
 *   give    - store a correction; from a review list a not-important / want-to-know
 *             verdict also takes the email off the list (dismissed / seen)
 *   report  - corrections and implicit labels (TODO = important, seen on the
 *             "Tudni akarom" list = want_to_know) against the prediction
 *   suggest - the mismatches and notes to the LLM, which proposes rules and prompt changes
 */
import db from '../db.js';
import { getJSON } from './llm.js';

export const VERDICTS = ['important', 'want_to_know', 'not_important'];
const SUGGEST_MODEL = process.env.LLM_IMPORTANCE_MODEL || 'email-llm';

const predictedOf = t => (!t || t.important === null || t.important === undefined || t.status !== 'evaluated')
  ? null : t.important ? 'important' : t.want_to_know ? 'want_to_know' : 'not_important';
const err = (status, msg) => Object.assign(new Error(msg), { status });

const triageOf = db.prepare(`SELECT important, want_to_know, status, reason, prompt_version, model FROM triage_results WHERE email_id = ?`);
const upsert = db.prepare(`INSERT INTO email_feedback (email_id, verdict, note, predicted, prompt_version, model, source)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(email_id) DO UPDATE SET verdict = excluded.verdict, note = excluded.note, predicted = excluded.predicted,
    prompt_version = excluded.prompt_version, model = excluded.model, source = excluded.source, created_at = datetime('now')`);
const review = db.prepare(`INSERT INTO email_review (email_id, list, decision) VALUES (?, ?, ?)
  ON CONFLICT(email_id) DO UPDATE SET list = excluded.list, decision = excluded.decision, decided_at = datetime('now')`);

/** The email's current verdict and the owner's correction, if any (reading view). */
export function get(emailId) {
  const t = triageOf.get(emailId);
  const f = db.prepare('SELECT verdict, note, created_at FROM email_feedback WHERE email_id = ?').get(emailId) || null;
  return { email_id: emailId, predicted: predictedOf(t), why: t?.reason || null, prompt_version: t?.prompt_version || null, feedback: f };
}

export function give(emailId, { verdict, note, list } = {}) {
  if (!VERDICTS.includes(verdict)) throw err(400, `verdict must be one of ${VERDICTS.join(', ')}`);
  if (!db.prepare('SELECT 1 FROM emails WHERE id = ?').get(emailId)) throw err(404, 'Email not found');
  const t = triageOf.get(emailId);
  const text = String(note || '').trim().slice(0, 1000) || null;
  db.transaction(() => {
    upsert.run(emailId, verdict, text, predictedOf(t), t?.prompt_version || null, t?.model || null, list ? `review:${list}` : 'reading');
    // Off the review list: nothing to do (not important) or nothing more to look at (want to know).
    if (list && verdict !== 'important') review.run(emailId, list, verdict === 'want_to_know' ? 'seen' : 'dismissed');
  })();
  return get(emailId);
}

export function remove(emailId) {
  db.prepare('DELETE FROM email_feedback WHERE email_id = ?').run(emailId);
  return get(emailId);
}

/** Every label since `since` (default 30 days): explicit corrections first, then the implicit ones. */
function labels(since) {
  const explicit = db.prepare(`SELECT f.email_id, f.verdict, f.note, f.predicted, f.prompt_version, f.model, f.source, f.created_at AS at,
      e.subject, e.sender_email, e.snippet, t.reason AS why
    FROM email_feedback f JOIN emails e ON e.id = f.email_id LEFT JOIN triage_results t ON t.email_id = f.email_id
    WHERE f.created_at >= ? ORDER BY f.created_at DESC`).all(since).map(r => ({ ...r, kind: 'explicit' }));
  const seen = new Set(explicit.map(r => r.email_id));
  // TODO from any list = important; "Láttam" on the want-to-know list = want_to_know. "Nem kell" says nothing about importance.
  const implicit = db.prepare(`SELECT r.email_id, r.list, r.decision, r.decided_at AS at, e.subject, e.sender_email, e.snippet,
      t.important, t.want_to_know, t.status, t.reason AS why, t.prompt_version, t.model
    FROM email_review r JOIN emails e ON e.id = r.email_id LEFT JOIN triage_results t ON t.email_id = r.email_id
    WHERE r.decided_at >= ? AND (r.decision = 'todo' OR (r.decision = 'seen' AND r.list = 'know'))`).all(since)
    .filter(r => !seen.has(r.email_id))
    .map(r => ({ email_id: r.email_id, verdict: r.decision === 'todo' ? 'important' : 'want_to_know', note: null,
      predicted: predictedOf(r), prompt_version: r.prompt_version, model: r.model, source: `review:${r.list}:${r.decision}`, at: r.at,
      subject: r.subject, sender_email: r.sender_email, snippet: r.snippet, why: r.why, kind: 'implicit' }));
  return [...explicit, ...implicit];
}

export function report({ days = 30 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(days) || 30) * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const all = labels(since);
  const matrix = Object.fromEntries(VERDICTS.map(p => [p, Object.fromEntries(VERDICTS.map(v => [v, 0]))]));
  let agree = 0, judged = 0;
  for (const l of all) {
    if (!l.predicted) continue;
    judged++; matrix[l.predicted][l.verdict]++;
    if (l.predicted === l.verdict) agree++;
  }
  const byVersion = {};
  for (const l of all.filter(x => x.predicted)) {
    const v = (l.prompt_version || '?').replace(/ \+ .*/, '');
    byVersion[v] ??= { n: 0, agree: 0 };
    byVersion[v].n++; if (l.predicted === l.verdict) byVersion[v].agree++;
  }
  return {
    since, n: all.length, judged, agree, matrix, by_version: byVersion,
    explicit: all.filter(l => l.kind === 'explicit').length,
    mismatches: all.filter(l => l.predicted && l.predicted !== l.verdict).map(({ snippet, ...l }) => l),
    notes: all.filter(l => l.note).map(({ snippet, ...l }) => l),
  };
}

const NAMES = { important: 'fontos', want_to_know: 'tudni akarom', not_important: 'nem fontos' };

/** Mismatches and notes to the LLM: proposed rules and prompt changes, in Hungarian. */
export async function suggest({ days = 30 } = {}) {
  const r = report({ days });
  const items = [...r.mismatches, ...r.notes.filter(n => n.predicted === n.verdict)].slice(0, 40);
  if (!items.length) throw err(400, 'Nincs még eltérés vagy megjegyzés, amiből javaslatot lehetne tenni.');
  const snip = new Map(labels(r.since).map(l => [l.email_id, l.snippet]));
  const lines = items.map((l, i) => [
    `#${i + 1} ${l.sender_email} | ${l.subject || ''}`,
    `   gép: ${NAMES[l.predicted] || 'nincs'} (${l.prompt_version || '?'}); tulajdonos: ${NAMES[l.verdict]}${l.note ? `; megjegyzés: ${l.note}` : ''}`,
    l.why ? `   gép indoka: ${l.why}` : null,
    snip.get(l.email_id) ? `   részlet: ${String(snip.get(l.email_id)).replace(/\s+/g, ' ').slice(0, 300)}` : null,
  ].filter(Boolean).join('\n')).join('\n');
  const system = `Egy e-mail-osztályozó hibáit elemzed. A tulajdonos definíciói:
- fontos: válasz vagy döntés kell, kötelező időpont, vagy fizetés;
- tudni akarom: tudnia kell róla, de nincs teendő;
- nem fontos: spam, reklám, egyszerű bejelentés.
A rendszer két részből áll: determinisztikus szabályok (feladó, domain, kulcsszó, lista, GitHub-repo alapján; verdikt: nem fontos / tudni akarom / fontos) és egy LLM-prompt.
Az alábbi esetekben a gép tévedett, vagy a tulajdonos megjegyzést írt. Csoportosítsd a hibákat mintázat szerint, és mindegyikhez javasolj konkrét javítást: vagy egy szabályt (feltételek és verdikt), vagy egy rövid promptmódosítást (a beírandó mondat). Csak arra tegyél javaslatot, amit legalább egy eset alátámaszt, és írd ki, melyik esetek (#szám). Ha egy eset egyedi, mondd meg, hogy nem érdemes rá szabályt írni. Magyarul, tömören. Válasz: JSON {"markdown": "..."}, a javaslatok markdownban.`;
  const out = await getJSON(system, lines, { model: SUGGEST_MODEL, maxTokens: 2500,
    metadata: { trace_name: 'ecc-feedback-suggest', tags: ['app:email-command-center'] } });
  if (typeof out?.markdown !== 'string' || !out.markdown.trim()) throw err(502, 'Az LLM nem adott javaslatot');
  return { model: SUGGEST_MODEL, cases: items.length, text: out.markdown };
}
