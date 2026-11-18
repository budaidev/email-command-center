/**
 * Importance evaluation (card #239): one LLM call per email with the rubric in
 * prompts/importance.js. Every call is a Langfuse trace (via LiteLLM) named
 * "ecc-importance", tagged with the prompt version and carrying the email's id
 * and Message-ID, so a human label can later be attached to it (card #240).
 */

import db from '../db.js';
import { getJSON } from './llm.js';
import { fetchBodies } from './imap.js';
import { getTextPrompt } from './langfuse.js';
import { IMPORTANCE_PROMPT_NAME, LOCAL_SYSTEM, CRITERIA, buildEmailMessage } from '../prompts/importance.js';

export const IMPORTANCE_MODEL = process.env.LLM_IMPORTANCE_MODEL || 'email-llm';
const PROMPT_LABEL = process.env.IMPORTANCE_PROMPT_LABEL || 'production';
const CONCURRENCY = 3;
const KINDS = new Set(['personal', 'work', 'transactional', 'notification', 'newsletter', 'advertising', 'spam']);
const ACTIONS = new Set(['reply', 'review', 'decide', 'schedule', 'pickup', 'send', 'delegate', 'task', 'none']);

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** "ecc-importance v3", or "ecc-importance local" when Langfuse was unreachable. */
export function promptLabel(p) {
  return `${p.name} ${p.source === 'langfuse' ? `v${p.version}` : 'local'}`;
}

/** Check the answer's shape and whether each quote really is in the email. */
function parseAnswer(raw, email) {
  const haystack = norm(`${email.subject || ''}\n${email.body_text || email.snippet || ''}`);
  const criteria = {};
  for (const c of CRITERIA) {
    const v = raw?.[c];
    if (!v || typeof v.answer !== 'boolean') throw new Error(`answer missing for ${c}`);
    const evidence = v.answer ? String(v.evidence || '').slice(0, 300) : '';
    criteria[c] = {
      answer: v.answer,
      evidence,
      // A quote the model did not copy from the email is not evidence.
      evidence_found: v.answer ? (evidence !== '' && haystack.includes(norm(evidence))) : null,
    };
  }
  const important = CRITERIA.some(c => criteria[c].answer);
  return {
    important,
    criteria,
    kind: KINDS.has(raw.kind) ? raw.kind : null,
    why: typeof raw.why === 'string' ? raw.why.slice(0, 400) : null,
    action_type: important && ACTIONS.has(raw.action_type) ? raw.action_type : 'none',
    suggested_task: important && typeof raw.suggested_task === 'string' ? raw.suggested_task.slice(0, 200) : null,
  };
}

async function evaluateOne(email, prompt) {
  const version = promptLabel(prompt);
  const raw = await getJSON(prompt.text, buildEmailMessage(email), {
    model: IMPORTANCE_MODEL,
    maxTokens: 800,
    metadata: {
      trace_name: 'ecc-importance',
      generation_name: 'ecc-importance',
      tags: ['app:email-command-center', `prompt:${version.replace(' ', ':')}`],
      trace_metadata: {
        email_id: email.id,
        message_id: email.message_id || null,
        prompt_name: prompt.name,
        prompt_version: prompt.version,
        prompt_source: prompt.source,
      },
    },
  });
  return parseAnswer(raw, email);
}

/** Fill body_text (and snippet) of emails that lack it from the local mailserver,
 *  and store it. Rows need account_id and uid. Failures leave the body empty. */
export async function ensureBodies(emails) {
  const missing = emails.filter(e => !(e.body_text && e.body_text.trim()) && e.account_id && e.uid);
  const byAccount = new Map();
  for (const e of missing) {
    if (!byAccount.has(e.account_id)) byAccount.set(e.account_id, []);
    byAccount.get(e.account_id).push(e);
  }
  const save = db.prepare('UPDATE emails SET body_text = ?, snippet = COALESCE(NULLIF(snippet, \'\'), ?) WHERE id = ?');
  for (const [accountId, list] of byAccount) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) continue;
    try {
      const bodies = await fetchBodies(account, list.map(e => e.uid));
      db.transaction(() => {
        for (const e of list) {
          const b = bodies.get(e.uid);
          if (!b) continue;
          e.body_text = b.body_text;
          e.snippet = e.snippet || b.snippet;
          save.run(b.body_text, b.snippet, e.id);
        }
      })();
    } catch (err) {
      console.warn(`[Importance] could not fetch bodies for ${accountId}: ${err.message}`);
    }
  }
}

/**
 * Evaluate emails (rows with id, account_id, uid, subject, sender_*, recipients,
 * date, snippet, body_text, message_id); missing bodies are fetched first.
 * Returns { results: Map(id -> evaluation | {error}), promptVersion, model }.
 */
export async function evaluateImportance(emails) {
  await ensureBodies(emails);
  const prompt = await getTextPrompt(IMPORTANCE_PROMPT_NAME, PROMPT_LABEL, LOCAL_SYSTEM);
  const results = new Map();
  let next = 0;
  async function worker() {
    while (next < emails.length) {
      const email = emails[next++];
      try {
        results.set(email.id, await evaluateOne(email, prompt));
      } catch (err) {
        results.set(email.id, { error: `LLM evaluation failed: ${err.message}`.slice(0, 300) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, emails.length) }, worker));
  return { results, promptVersion: promptLabel(prompt), model: IMPORTANCE_MODEL };
}

/** AI share of the 0-100 triage score: the rubric is yes/no, so 50 or 0. */
export const aiScoreOf = ev => (ev.important ? 50 : 0);
