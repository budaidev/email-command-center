/**
 * AI Email Triage Service
 *
 * Scores every email on how much user attention is needed (0-100).
 * Learns from user feedback (approve/dismiss/create_task) via few-shot
 * examples and a periodically summarized preference profile.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { getJSON } from '../services/llm.js';
import { evaluateImportance, aiScoreOf } from './importance.js';
import {
  SYSTEM,
  buildUserMessage,
  SUMMARIZE_SYSTEM,
  buildSummarizeMessage,
} from '../prompts/triage-emails.js';
import { loadScoringRules, computeRuleScore } from './scoring.js';
import { getSetting, setSetting, placeholders } from '../utils/settings.js';

export const VALID_ACTIONS = new Set([
  'reply', 'review', 'decide', 'schedule', 'pickup',
  'send', 'delegate', 'task', 'none',
]);

/**
 * Fetch email metadata for a batch of IDs, joined with categories.
 */
function fetchEmailBatch(emailIds) {
  return db.prepare(`
    SELECT e.id, e.subject, e.sender_name, e.sender_email, e.recipients,
           e.date, e.snippet, e.body_text, e.labels, e.message_id, e.account_id, e.uid,
           e.category_id, e.is_read,
           c.name AS category_name
    FROM emails e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.id IN (${placeholders(emailIds.length)})
    ORDER BY e.date DESC
  `).all(...emailIds);
}

/**
 * Get the N most recent feedback decisions with email context (for few-shot prompts).
 */
export function getTriageFeedbackExamples(n = 15) {
  return db.prepare(`
    SELECT f.decision, f.triage_score, f.triage_action, f.reason,
           e.sender_email, e.subject, c.name AS category_name
    FROM triage_feedback f
    JOIN emails e ON f.email_id = e.id
    LEFT JOIN categories c ON e.category_id = c.id
    ORDER BY f.created_at DESC
    LIMIT ?
  `).all(n);
}

/**
 * Triage a batch of emails via a single LLM call.
 * Called from the sync pipeline (fire-and-forget) and the manual trigger endpoint.
 */
export async function triageEmails(emailIds, force = false) {
  if (!emailIds || emailIds.length === 0) return 0;

  const enabled = getSetting('triage_enabled');
  if (enabled === 'false') {
    console.log('[Triage] Disabled, skipping');
    return 0;
  }

  // If not forcing, filter out emails that already have triage results
  let idsToProcess = emailIds;
  if (!force) {
    const existing = new Set(
      db.prepare(`SELECT email_id FROM triage_results WHERE email_id IN (${placeholders(emailIds.length)})`)
        .all(...emailIds)
        .map(r => r.email_id)
    );
    idsToProcess = emailIds.filter(id => !existing.has(id));
  }

  if (idsToProcess.length === 0) return 0;

  const allEmails = fetchEmailBatch(idsToProcess);
  if (allEmails.length === 0) return 0;

  console.log(`[Triage] Evaluating ${allEmails.length} emails with the importance rubric`);

  // Pre-compute rule scores for all emails
  const scoringRules = loadScoringRules();
  const ruleScoreMap = new Map();
  for (const email of allEmails) {
    ruleScoreMap.set(email.id, computeRuleScore(email, scoringRules));
  }

  const { results, promptVersion, model } = await evaluateImportance(allEmails);

  const upsert = db.prepare(`
    INSERT INTO triage_results (email_id, score, rule_score, ai_score, matched_rules, action_type, reason, suggested_task,
                                model, status, error, important, criteria, prompt_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'evaluated', NULL, ?, ?, ?, datetime('now'))
    ON CONFLICT(email_id) DO UPDATE SET
      score = excluded.score, rule_score = excluded.rule_score, ai_score = excluded.ai_score,
      matched_rules = excluded.matched_rules, action_type = excluded.action_type,
      reason = excluded.reason, suggested_task = excluded.suggested_task,
      model = excluded.model, status = 'evaluated', error = NULL,
      important = excluded.important, criteria = excluded.criteria, prompt_version = excluded.prompt_version,
      updated_at = datetime('now')
  `);
  // An email the LLM did not answer for: keep any earlier evaluation, otherwise record why.
  const markNotEvaluated = db.prepare(`
    INSERT INTO triage_results (email_id, score, rule_score, ai_score, matched_rules, action_type, model, status, error, prompt_version, updated_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, 'not_evaluated', ?, ?, datetime('now'))
    ON CONFLICT(email_id) DO UPDATE SET error = excluded.error, updated_at = datetime('now')
      WHERE triage_results.status = 'not_evaluated'
  `);

  let totalCount = 0;
  const store = db.transaction(() => {
    for (const e of allEmails) {
      const ev = results.get(e.id);
      const rr = ruleScoreMap.get(e.id) || { ruleScore: 0, matchedRules: [], ruleActionType: null };
      if (!ev || ev.error) {
        markNotEvaluated.run(e.id, rr.ruleScore, rr.ruleScore, JSON.stringify(rr.matchedRules),
          rr.ruleActionType || 'none', model, (ev?.error || 'No AI answer').slice(0, 300), promptVersion);
        continue;
      }
      const aiScore = aiScoreOf(ev);
      upsert.run(
        e.id, Math.max(0, Math.min(100, rr.ruleScore + aiScore)), rr.ruleScore, aiScore,
        JSON.stringify(rr.matchedRules), rr.ruleActionType || ev.action_type || 'none',
        ev.why, ev.suggested_task, ev.model || model,
        ev.important ? 1 : 0, JSON.stringify({ ...ev.criteria, kind: ev.kind, ...(ev.score ? { score: ev.score } : {}) }), ev.prompt_version || promptVersion,
      );
      totalCount++;
    }
  });
  store();

  console.log(`[Triage] Done: ${totalCount} evaluated of ${allEmails.length} (${model}, ${promptVersion})`);
  return totalCount;
}

/**
 * Convenience wrapper called from sync pipeline.
 */
export async function triageNewEmails(emailIds) {
  return triageEmails(emailIds, false);
}

/**
 * Compress all feedback into a learned preference profile paragraph.
 * Called every 20 feedback actions, or manually.
 */
export async function summarizeLearnedPreferences() {
  const decisions = db.prepare(`
    SELECT f.decision, f.reason,
           e.sender_email, e.subject, c.name AS category_name
    FROM triage_feedback f
    JOIN emails e ON f.email_id = e.id
    LEFT JOIN categories c ON e.category_id = c.id
    ORDER BY f.created_at DESC
    LIMIT 100
  `).all();

  if (decisions.length < 5) {
    console.log('[Triage] Not enough feedback to summarize yet');
    return;
  }

  console.log(`[Triage] Summarizing preferences from ${decisions.length} decisions`);
  const response = await getJSON(SUMMARIZE_SYSTEM, buildSummarizeMessage(decisions));
  const profile = response?.profile;

  if (profile && typeof profile === 'string') {
    setSetting('triage_learned_profile', profile);
    console.log(`[Triage] Learned profile updated (${profile.length} chars)`);
  }
}

/**
 * Build a prompt preview — shows exactly what the LLM would see.
 */
export function buildPromptPreview(sampleSize = 5) {
  const instructions = getSetting('triage_instructions');
  const learnedProfile = getSetting('triage_learned_profile');
  const feedbackExamples = getTriageFeedbackExamples(15);

  // Get a small sample of recent emails for the "sample" tab
  const sampleEmails = db.prepare(`
    SELECT e.id, e.subject, e.sender_name, e.sender_email, e.date, e.snippet,
           c.name AS category_name
    FROM emails e
    LEFT JOIN categories c ON e.category_id = c.id
    ORDER BY e.date DESC LIMIT ?
  `).all(sampleSize);

  const fullUserMessage = buildUserMessage(sampleEmails, instructions, learnedProfile, feedbackExamples);

  // Split the user message into sections for the UI
  const contextParts = [];
  contextParts.push('USER INSTRUCTIONS:');
  contextParts.push(instructions || '(none set)');
  contextParts.push('');
  if (learnedProfile) {
    contextParts.push('LEARNED PREFERENCES:');
    contextParts.push(learnedProfile);
    contextParts.push('');
  }
  if (feedbackExamples.length > 0) {
    contextParts.push(`PAST DECISIONS (${feedbackExamples.length} recent):`);
    for (const ex of feedbackExamples) {
      const label = ex.decision === 'create_task' ? 'CREATED TASK' : ex.decision.toUpperCase();
      contextParts.push(
        `- From "${ex.sender_email}", subject "${ex.subject}"` +
        (ex.category_name ? ` [${ex.category_name}]` : '') +
        ` → AI scored ${ex.triage_score ?? '?'}/${ex.triage_action ?? '?'}, user ${label}` +
        (ex.reason ? ` (${ex.reason})` : '')
      );
    }
  }

  // Build sample section
  const sampleParts = [];
  for (const e of sampleEmails) {
    sampleParts.push(`[email:${e.id}]`);
    sampleParts.push(`From: ${e.sender_name || ''} <${e.sender_email}>`);
    sampleParts.push(`Subject: ${e.subject || '(no subject)'}`);
    sampleParts.push(`Date: ${e.date}`);
    if (e.category_name) sampleParts.push(`Category: ${e.category_name}`);
    if (e.snippet) sampleParts.push(`Snippet: ${e.snippet.slice(0, 300)}`);
    sampleParts.push('');
  }

  const totalFeedback = db.prepare('SELECT COUNT(*) AS n FROM triage_feedback').get().n;
  const totalTriaged = db.prepare('SELECT COUNT(*) AS n FROM triage_results').get().n;

  return {
    system: SYSTEM,
    context: contextParts.join('\n'),
    sample: sampleParts.join('\n'),
    feedbackExamples,
    stats: { totalFeedback, totalTriaged },
  };
}

/**
 * Backtest: run triage with draft instructions on emails that have feedback,
 * then compare against actual user decisions.
 */
export async function runBacktest(draftInstructions, draftProfile, limit = 20) {
  // Get emails that have feedback
  const feedbackEmails = db.prepare(`
    SELECT f.decision AS user_decision, f.triage_score AS old_score,
           e.id, e.subject, e.sender_name, e.sender_email, e.date, e.snippet,
           e.category_id, c.name AS category_name
    FROM triage_feedback f
    JOIN emails e ON f.email_id = e.id
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE f.id IN (SELECT MAX(id) FROM triage_feedback GROUP BY email_id)
    ORDER BY f.created_at DESC
    LIMIT ?
  `).all(limit);

  if (feedbackEmails.length === 0) return { tested: 0, matches: 0, mismatches: 0, results: [] };

  const instructions = draftInstructions || getSetting('triage_instructions');
  const learnedProfile = draftProfile !== undefined ? draftProfile : getSetting('triage_learned_profile');
  const feedbackExamples = getTriageFeedbackExamples(15);

  const userMessage = buildUserMessage(feedbackEmails, instructions, learnedProfile, feedbackExamples);
  const maxTokens = Math.max(2000, feedbackEmails.length * 120);

  const response = await getJSON(SYSTEM, userMessage, { maxTokens });
  const llmResults = response?.results;
  if (!Array.isArray(llmResults)) return { tested: 0, matches: 0, mismatches: 0, results: [] };

  const scoreMap = {};
  for (const r of llmResults) {
    if (r.email_id) scoreMap[r.email_id] = r;
  }

  let matches = 0;
  let mismatches = 0;
  const results = [];

  for (const email of feedbackEmails) {
    const llm = scoreMap[email.id];
    const newScore = llm ? Math.max(0, Math.min(100, Math.round(Number(llm.score) || 0))) : null;
    const wouldFlag = newScore !== null && newScore >= 50;
    const userApproved = email.user_decision === 'approve' || email.user_decision === 'create_task';
    const wouldMatch = wouldFlag === userApproved;

    if (wouldMatch) matches++;
    else mismatches++;

    results.push({
      email_id: email.id,
      subject: email.subject,
      sender_email: email.sender_email,
      category_name: email.category_name,
      old_score: email.old_score,
      new_score: newScore,
      user_decision: email.user_decision,
      would_match: wouldMatch,
      reason: llm?.reason || null,
    });
  }

  return { tested: feedbackEmails.length, matches, mismatches, results };
}
