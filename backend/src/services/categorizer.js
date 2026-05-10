import db from '../db.js';
import { runActionsForBatch } from './action-runner.js';

export function parseRecipients(recipientsJson) {
  try { return JSON.parse(recipientsJson || '[]'); } catch { return []; }
}

function matchRule(email, rule) {
  const recipients    = parseRecipients(email.recipients);
  const recipientEmails  = recipients.map(r => (r.email || '').toLowerCase());
  const recipientDomains = recipients.map(r => (r.email || '').split('@')[1]?.toLowerCase() || '');

  const ruleVal = rule.value.toLowerCase();

  // Multi-value fields — rule matches if ANY recipient matches
  if (rule.field === 'recipient_email') {
    return recipientEmails.some(v => applyOperator(v, rule.operator, ruleVal));
  }
  if (rule.field === 'recipient_domain') {
    return recipientDomains.some(v => applyOperator(v, rule.operator, ruleVal));
  }

  const fields = {
    sender_email:  (email.sender_email || '').toLowerCase(),
    sender_domain: (email.sender_email || '').split('@')[1]?.toLowerCase() || '',
    sender_name:   (email.sender_name  || '').toLowerCase(),
    subject:       (email.subject      || '').toLowerCase(),
  };
  return applyOperator(fields[rule.field] || '', rule.operator, ruleVal);
}

export function testRule(email, rule) { return matchRule(email, rule); }

export function applyOperator(val, operator, ruleVal) {
  switch (operator) {
    case 'contains':    return val.includes(ruleVal);
    case 'equals':      return val === ruleVal;
    case 'starts_with': return val.startsWith(ruleVal);
    case 'ends_with':   return val.endsWith(ruleVal);
    default:            return false;
  }
}

export function buildCategoryIndex() {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, created_at').all();
  const rules      = db.prepare('SELECT * FROM category_rules ORDER BY sort_order').all();
  return categories.map(c => ({ ...c, rules: rules.filter(r => r.category_id === c.id) }));
}

export function categorizeEmail(email, index) {
  for (const cat of index) {
    if (cat.rules.some(r => matchRule(email, r))) return cat.id;
  }
  return null;
}

/**
 * Dry-run: compute categorization without saving.
 * Returns { categories: [{id,name,color,behavior,count}], uncategorized_count, total }
 * and a map of emailIdsByCategory for use by preview/emails endpoint.
 */
export function previewCategorization() {
  const index  = buildCategoryIndex();
  const emails = db.prepare('SELECT id, sender_email, sender_name, subject, date, snippet, recipients FROM emails ORDER BY date DESC').all();

  const buckets = {};
  for (const cat of index) buckets[cat.id] = [];
  const uncategorized = [];

  for (const email of emails) {
    let matched = false;
    for (const cat of index) {
      if (cat.rules.some(r => matchRule(email, r))) {
        buckets[cat.id].push(email);
        matched = true;
        break;
      }
    }
    if (!matched) uncategorized.push(email);
  }

  return {
    total: emails.length,
    uncategorized_count: uncategorized.length,
    categories: index.map(c => ({ id: c.id, name: c.name, color: c.color, behavior: c.behavior, count: buckets[c.id].length })),
    _buckets: buckets,
    _uncategorized: uncategorized,
  };
}

/** Re-categorize all emails — call after rules change. */
export function applyCategoriesToAll() {
  const index  = buildCategoryIndex();
  const emails = db.prepare('SELECT id, sender_email, sender_name, subject, recipients FROM emails').all();
  const update = db.prepare('UPDATE emails SET category_id = ? WHERE id = ?');
  db.transaction(() => {
    for (const email of emails) {
      update.run(categorizeEmail(email, index), email.id);
    }
  })();
  return emails.length;
}

/** Categorize a batch of newly inserted emails by their IDs. */
export function applyCategoriesToNew(emailIds) {
  if (!emailIds.length) return;
  const index  = buildCategoryIndex();
  const ph = emailIds.map(() => '?').join(',');
  const emails = db.prepare(`SELECT id, sender_email, sender_name, subject, recipients FROM emails WHERE id IN (${ph})`).all(...emailIds);
  const update = db.prepare('UPDATE emails SET category_id = ? WHERE id = ?');
  const pairs = [];
  db.transaction(() => {
    for (const email of emails) {
      const categoryId = categorizeEmail(email, index);
      update.run(categoryId, email.id);
      if (categoryId) pairs.push({ emailId: email.id, categoryId });
    }
  })();
  // Fire-and-forget action execution for categorized emails
  if (pairs.length) {
    runActionsForBatch(pairs).catch(err =>
      console.error('[Actions] Batch execution error:', err.message)
    );
  }
}
