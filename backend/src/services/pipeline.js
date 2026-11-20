/**
 * Email Processing Pipeline
 *
 * Orchestrates sequential enrichment → scoring → action steps.
 * Each step reads from emails + email_enrichments.data and writes back.
 * Steps are configurable via the pipeline_steps table.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { getJSON, getModel } from './llm.js';
import { applyCategoriesToNew } from './categorizer.js';
import { loadScoringRules, computeRuleScore } from './scoring.js';
import { runActionsForBatch } from './action-runner.js';
import { getSetting, placeholders } from '../utils/settings.js';
import { evaluateImportance, aiScoreOf } from './importance.js';
import { SYSTEM as SUMMARY_SYSTEM } from '../prompts/summarize-email.js';
import { SYSTEM as REF_SYSTEM, buildUserMessage as refBuildUserMessage } from '../prompts/extract-references.js';

/* ─── Helpers ─── */

function getEnrichments(emailId) {
  const row = db.prepare('SELECT data FROM email_enrichments WHERE email_id = ?').get(emailId);
  return row ? JSON.parse(row.data) : {};
}

function setEnrichments(emailId, data) {
  const json = JSON.stringify(data);
  db.prepare(`
    INSERT INTO email_enrichments (email_id, data) VALUES (?, ?)
    ON CONFLICT(email_id) DO UPDATE SET data = excluded.data
  `).run(emailId, json);
}

function appendStepRun(emailId, stepName) {
  const row = db.prepare('SELECT steps_run FROM email_enrichments WHERE email_id = ?').get(emailId);
  const steps = JSON.parse(row?.steps_run || '[]');
  if (!steps.includes(stepName)) steps.push(stepName);
  db.prepare('UPDATE email_enrichments SET steps_run = ? WHERE email_id = ?').run(JSON.stringify(steps), emailId);
}

function fetchEmails(emailIds) {
  return db.prepare(`
    SELECT e.id, e.subject, e.sender_name, e.sender_email, e.recipients,
           e.date, e.snippet, e.body_text, e.labels, e.message_id, e.account_id, e.uid,
           e.category_id, e.is_read,
           c.name AS category_name, c.color AS category_color
    FROM emails e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.id IN (${placeholders(emailIds.length)})
    ORDER BY e.date DESC
  `).all(...emailIds);
}

/* ─── Step Implementations ─── */

async function categorizeStep(emailIds, _config) {
  applyCategoriesToNew(emailIds);
  // Write category info to enrichments
  const emails = fetchEmails(emailIds);
  for (const e of emails) {
    const data = getEnrichments(e.id);
    data.category_name = e.category_name || null;
    data.category_color = e.category_color || null;
    setEnrichments(e.id, data);
  }
  console.log(`[Pipeline:categorize] Processed ${emailIds.length} emails`);
}

async function summaryStep(emailIds, config) {
  const maxChars = config?.max_chars || 500;
  const skipIfNoBody = config?.skip_if_no_body !== false;
  const emails = fetchEmails(emailIds);

  let generated = 0;
  for (const email of emails) {
    // Skip if no body and configured to skip
    if (skipIfNoBody && (!email.body_text || email.body_text.length === 0)) {
      // Use snippet as a minimal summary
      const data = getEnrichments(email.id);
      data.summary = email.snippet?.slice(0, maxChars) || null;
      setEnrichments(email.id, data);
      continue;
    }

    // Check if we already have a cached summary
    const cached = db.prepare('SELECT content FROM summaries WHERE scope_key = ? AND type = ?').get(email.id, 'email');
    if (cached?.content) {
      const data = getEnrichments(email.id);
      data.summary = cached.content.slice(0, maxChars);
      setEnrichments(email.id, data);
      continue;
    }

    // Generate summary via LLM
    try {
      const bodyText = (email.body_text || email.snippet || '').slice(0, 8000);
      const userMsg = `Subject: ${email.subject}\nFrom: ${email.sender_name} <${email.sender_email}>\nDate: ${email.date}\n\n${bodyText}`;
      const result = await getJSON(
        SUMMARY_SYSTEM + '\nReturn JSON: {"summary": "2-3 sentence TL;DR"}',
        userMsg,
        { maxTokens: 500 },
      );
      const summary = result?.summary || result?.tldr || '';
      if (summary) {
        // Cache in summaries table
        const model = await getModel();
        db.prepare('INSERT OR IGNORE INTO summaries (id, type, scope_key, content, model) VALUES (?, ?, ?, ?, ?)').run(
          uuidv4(), 'email', email.id, summary, model,
        );
        const data = getEnrichments(email.id);
        data.summary = summary.slice(0, maxChars);
        setEnrichments(email.id, data);
        generated++;
      }
    } catch (err) {
      console.warn(`[Pipeline:summary] Failed for ${email.id}:`, err.message);
    }
  }
  console.log(`[Pipeline:summary] ${generated} generated, ${emails.length - generated} skipped/cached`);
}

async function referencesStep(emailIds, _config) {
  let extracted = 0;
  for (const emailId of emailIds) {
    const data = getEnrichments(emailId);
    if (!data.summary) continue;

    try {
      const result = await getJSON(
        REF_SYSTEM,
        refBuildUserMessage(data.summary),
        { maxTokens: 500 },
      );
      const refs = result?.references || [];
      data.references = {
        deadlines: refs.filter(r => r.type === 'date' || r.type === 'deadline').map(r => r.content),
        amounts: refs.filter(r => r.type === 'amount').map(r => r.content),
        contacts: refs.filter(r => r.type === 'contact').map(r => r.content),
        links: refs.filter(r => r.type === 'link').map(r => r.content),
        actions: refs.filter(r => r.type === 'action').map(r => r.content),
      };
      setEnrichments(emailId, data);
      extracted++;
    } catch (err) {
      console.warn(`[Pipeline:references] Failed for ${emailId}:`, err.message);
    }
  }
  console.log(`[Pipeline:references] Extracted from ${extracted}/${emailIds.length} emails`);
}

async function autoTagStep(emailIds, _config) {
  // Run auto_tag actions from category_actions for categorized emails
  const categorized = db.prepare(`
    SELECT id, category_id FROM emails WHERE id IN (${placeholders(emailIds.length)}) AND category_id IS NOT NULL
  `).all(...emailIds);

  if (categorized.length > 0) {
    const pairs = categorized.map(e => ({ emailId: e.id, categoryId: e.category_id }));
    // action-runner handles auto_tag type internally
    await runActionsForBatch(pairs);
  }

  // Write tags to enrichments
  for (const emailId of emailIds) {
    const tags = db.prepare(`
      SELECT t.name FROM tags t JOIN email_tags et ON t.id = et.tag_id WHERE et.email_id = ?
    `).all(emailId).map(r => r.name);
    const data = getEnrichments(emailId);
    data.tags = tags;
    setEnrichments(emailId, data);
  }
  console.log(`[Pipeline:auto_tag] Processed ${emailIds.length} emails`);
}

async function scoreStep(emailIds, config) {
  const aiEnabled = config?.ai_enabled !== false;
  const emails = fetchEmails(emailIds);
  const scoringRules = loadScoringRules();

  // Compute rule scores with enrichment data
  const ruleScoreMap = new Map();
  for (const email of emails) {
    const enrichments = getEnrichments(email.id);
    const result = computeRuleScore(email, scoringRules, enrichments);
    ruleScoreMap.set(email.id, result);
  }

  // AI part: the importance rubric (card #239), one traced call per email.
  let evals = new Map();
  let promptVersion = null;
  let model = null;
  if (aiEnabled && emails.length > 0) {
    ({ results: evals, promptVersion, model } = await evaluateImportance(emails));
  }

  const upsert = db.prepare(`
    INSERT INTO triage_results (email_id, score, rule_score, ai_score, matched_rules, action_type, reason, suggested_task,
                                model, status, error, important, criteria, prompt_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(email_id) DO UPDATE SET
      score = excluded.score, rule_score = excluded.rule_score, ai_score = excluded.ai_score,
      matched_rules = excluded.matched_rules, action_type = excluded.action_type,
      reason = excluded.reason, suggested_task = excluded.suggested_task,
      model = excluded.model, status = excluded.status, error = excluded.error,
      important = excluded.important, criteria = excluded.criteria, prompt_version = excluded.prompt_version,
      updated_at = datetime('now')
  `);

  let count = 0;
  let notEvaluated = 0;
  const insertAll = db.transaction(() => {
    for (const email of emails) {
      const ruleResult = ruleScoreMap.get(email.id) || { ruleScore: 0, matchedRules: [], ruleActionType: null };
      // No AI answer is "not evaluated", never "not important".
      const ev = evals.get(email.id);
      const ok = ev && !ev.error;
      const evaluated = !aiEnabled || ok;
      const aiScore = ok ? aiScoreOf(ev) : 0; // 0 + status not_evaluated, see migration 015
      const finalScore = Math.max(0, Math.min(100, ruleResult.ruleScore + aiScore));
      const actionType = ruleResult.ruleActionType || (ok ? ev.action_type : null) || 'none';
      if (!evaluated) notEvaluated++;

      upsert.run(
        email.id, finalScore, ruleResult.ruleScore, aiScore,
        JSON.stringify(ruleResult.matchedRules),
        actionType, ok ? ev.why : null, ok ? ev.suggested_task : null, (ok && ev.model) || model,
        evaluated ? 'evaluated' : 'not_evaluated',
        evaluated ? null : (ev?.error || 'No AI answer'),
        ok ? (ev.important ? 1 : 0) : null,
        ok ? JSON.stringify({ ...ev.criteria, kind: ev.kind }) : null,
        aiEnabled ? ((ok && ev.prompt_version) || promptVersion) : null,
      );

      // Also store in enrichments
      const data = getEnrichments(email.id);
      data.score = { final: finalScore, rule: ruleResult.ruleScore, ai: aiScore, matched_rules: ruleResult.matchedRules,
        status: evaluated ? 'evaluated' : 'not_evaluated', important: ok ? ev.important : null };
      setEnrichments(email.id, data);
      count++;
    }
  });
  insertAll();
  console.log(`[Pipeline:score] Scored ${count} emails (AI ${aiEnabled ? `${model}, ${promptVersion}` : 'disabled'}), ${notEvaluated} not evaluated`);
}

async function actionsStep(emailIds, _config) {
  // Run non-tag category actions (script, webhook, ai_prompt)
  const categorized = db.prepare(`
    SELECT id, category_id FROM emails WHERE id IN (${placeholders(emailIds.length)}) AND category_id IS NOT NULL
  `).all(...emailIds);

  if (categorized.length > 0) {
    const pairs = categorized.map(e => ({ emailId: e.id, categoryId: e.category_id }));
    await runActionsForBatch(pairs);
  }
  console.log(`[Pipeline:actions] Processed ${categorized.length} categorized emails`);
}

/* ─── Step Registry ─── */

const STEP_REGISTRY = {
  categorize: categorizeStep,
  summary: summaryStep,
  references: referencesStep,
  auto_tag: autoTagStep,
  score: scoreStep,
  actions: actionsStep,
};

/* ─── Pipeline Orchestrator ─── */

export async function runPipeline(emailIds, stepFilter = null) {
  if (!emailIds || emailIds.length === 0) return;

  // Load active steps in order, optionally filtered
  let steps = db.prepare(
    'SELECT * FROM pipeline_steps WHERE is_active = 1 ORDER BY sort_order, created_at'
  ).all();

  if (stepFilter && Array.isArray(stepFilter) && stepFilter.length > 0) {
    const filterSet = new Set(stepFilter);
    steps = steps.filter(s => filterSet.has(s.name));
  }

  console.log(`[Pipeline] Starting for ${emailIds.length} emails, ${steps.length} active steps`);
  const pipelineStart = new Date().toISOString();

  // Initialize enrichment rows
  const initEnrichment = db.prepare(`
    INSERT INTO email_enrichments (email_id, started_at, pipeline_version)
    VALUES (?, ?, 1)
    ON CONFLICT(email_id) DO UPDATE SET
      started_at = excluded.started_at, error = NULL, steps_run = '[]'
  `);
  for (const id of emailIds) {
    initEnrichment.run(id, pipelineStart);
  }

  // Run each step sequentially
  for (const step of steps) {
    const fn = STEP_REGISTRY[step.name];
    if (!fn) {
      console.warn(`[Pipeline] Unknown step: ${step.name}, skipping`);
      continue;
    }

    const config = JSON.parse(step.config || '{}');
    try {
      await fn(emailIds, config);
      // Mark step as completed for all emails
      for (const id of emailIds) {
        appendStepRun(id, step.name);
      }
    } catch (err) {
      console.error(`[Pipeline] Step "${step.name}" failed:`, err.message);
      // Log error but continue to next step
      for (const id of emailIds) {
        db.prepare('UPDATE email_enrichments SET error = ? WHERE email_id = ?')
          .run(`Step "${step.name}" failed: ${err.message}`, id);
      }
    }
  }

  // Mark pipeline completed
  const completedAt = new Date().toISOString();
  for (const id of emailIds) {
    db.prepare('UPDATE email_enrichments SET completed_at = ? WHERE email_id = ?').run(completedAt, id);
  }

  console.log(`[Pipeline] Completed for ${emailIds.length} emails`);
}
