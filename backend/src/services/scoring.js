/**
 * Static scoring engine — computes rule-based score (0-50) for each email.
 * Rules match on sender, domain, subject, category, keywords, recipients.
 * Combined with AI score (0-50) to produce final triage score (0-100).
 */

import db from '../db.js';
import { applyOperator, parseRecipients } from './categorizer.js';
import { placeholders as ph } from '../utils/settings.js';

/**
 * Load all active scoring rules from the database.
 */
export function loadScoringRules() {
  return db.prepare(
    'SELECT * FROM scoring_rules WHERE is_active = 1 ORDER BY sort_order, created_at'
  ).all();
}

/**
 * Test a single rule against an email. Returns true if the rule matches.
 * Accepts optional enrichments for matching against derived fields.
 */
function testRule(email, rule, enrichments = {}) {
  const ruleVal = rule.value.toLowerCase();

  // Enrichment fields — match against pipeline-generated data
  if (rule.field === 'summary') {
    return applyOperator((enrichments.summary || '').toLowerCase(), rule.operator, ruleVal);
  }
  if (rule.field === 'has_deadline') {
    const has = (enrichments.references?.deadlines?.length > 0);
    return ruleVal === 'true' ? has : !has;
  }
  if (rule.field === 'has_amount') {
    const has = (enrichments.references?.amounts?.length > 0);
    return ruleVal === 'true' ? has : !has;
  }
  if (rule.field === 'entity') {
    const entities = (enrichments.references?.contacts || []).join(' ').toLowerCase();
    return applyOperator(entities, rule.operator, ruleVal);
  }

  // Category field — matches against the category name
  if (rule.field === 'category') {
    const catName = (email.category_name || '').toLowerCase();
    return applyOperator(catName, rule.operator, ruleVal);
  }

  // Keyword field — searches subject + snippet + body_text
  if (rule.field === 'keyword') {
    const text = [
      email.subject || '',
      email.snippet || '',
      email.body_text || '',
    ].join(' ').toLowerCase();
    return text.includes(ruleVal); // keyword always uses "contains"
  }

  // Recipient fields — match if ANY recipient matches
  if (rule.field === 'recipient_email' || rule.field === 'recipient_domain') {
    const recipients = parseRecipients(email.recipients);
    if (rule.field === 'recipient_email') {
      return recipients.some(r => applyOperator((r.email || '').toLowerCase(), rule.operator, ruleVal));
    }
    return recipients.some(r => {
      const domain = (r.email || '').split('@')[1]?.toLowerCase() || '';
      return applyOperator(domain, rule.operator, ruleVal);
    });
  }

  // Standard fields
  const fields = {
    sender_email:  (email.sender_email || '').toLowerCase(),
    sender_domain: (email.sender_email || '').split('@')[1]?.toLowerCase() || '',
    sender_name:   (email.sender_name  || '').toLowerCase(),
    subject:       (email.subject      || '').toLowerCase(),
  };

  const val = fields[rule.field];
  if (val === undefined) return false;
  return applyOperator(val, rule.operator, ruleVal);
}

/**
 * Compute the static rule score for an email.
 * Accepts optional enrichments data for matching against summary, references, etc.
 * Returns { ruleScore, matchedRules, ruleActionType }
 */
export function computeRuleScore(email, rules, enrichments = {}) {
  let totalScore = 0;
  const matchedRules = [];
  let ruleActionType = null;
  let highestActionScore = -Infinity;

  for (const rule of rules) {
    if (testRule(email, rule, enrichments)) {
      totalScore += rule.score;
      matchedRules.push({ id: rule.id, label: rule.label || `${rule.field} ${rule.operator} "${rule.value}"`, score: rule.score });

      // Track the action_type from the highest-scoring matched rule
      if (rule.action_type && rule.score > highestActionScore) {
        ruleActionType = rule.action_type;
        highestActionScore = rule.score;
      }
    }
  }

  return {
    ruleScore: Math.max(0, Math.min(50, totalScore)),
    matchedRules,
    ruleActionType,
  };
}

/**
 * Test scoring rules against a batch of emails (dry run, no save).
 */
export function testScoringRules(emailIds, rules) {
  if (!rules) rules = loadScoringRules();

  const emails = db.prepare(`
    SELECT e.id, e.subject, e.sender_name, e.sender_email, e.recipients,
           e.snippet, e.body_text, e.category_id,
           c.name AS category_name
    FROM emails e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.id IN (${ph(emailIds.length)})
    ORDER BY e.date DESC
  `).all(...emailIds);

  return emails.map(email => {
    const { ruleScore, matchedRules, ruleActionType } = computeRuleScore(email, rules);
    return {
      email_id: email.id,
      subject: email.subject,
      sender_email: email.sender_email,
      category_name: email.category_name,
      rule_score: ruleScore,
      matched_rules: matchedRules,
      rule_action_type: ruleActionType,
    };
  });
}
