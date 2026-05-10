import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import db from '../db.js';
import { getJSON, getModel } from './llm.js';
import { fetchMessage } from './imap.js';

const execFileAsync = promisify(execFile);

/**
 * Run all active actions for a categorized email.
 * Called after categorization assigns a category_id.
 */
export async function runActionsForEmail(emailId, categoryId) {
  if (!categoryId) return;

  const actions = db.prepare(`
    SELECT * FROM category_actions
    WHERE category_id = ? AND is_active = 1
    ORDER BY sort_order
  `).all(categoryId);

  if (!actions.length) return;

  // Fetch full email for action context
  const email = db.prepare(`
    SELECT e.*, c.name AS category_name
    FROM emails e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.id = ?
  `).get(emailId);

  if (!email) return;

  // If body is missing, fetch it via IMAP (GitHub emails are HTML-only, fetched lazily)
  if (!email.body_text && !email.body_html) {
    try {
      const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(email.account_id);
      if (account) {
        const full = await fetchMessage(account, email.uid);
        if (full) {
          if (full.body_text) { email.body_text = full.body_text; db.prepare('UPDATE emails SET body_text = ? WHERE id = ?').run(full.body_text, email.id); }
          if (full.body_html) { email.body_html = full.body_html; db.prepare('UPDATE emails SET body_html = ? WHERE id = ?').run(full.body_html, email.id); }
        }
      }
    } catch (err) {
      console.warn(`[Action] Could not fetch body for ${emailId}:`, err.message);
    }
  }

  for (const action of actions) {
    try {
      const config = JSON.parse(action.config || '{}');
      const result = await executeAction(action.type, config, email);
      logAction(action.id, emailId, 'success', result);
    } catch (err) {
      console.error(`[Action] ${action.type} failed for email ${emailId}:`, err.message);
      logAction(action.id, emailId, 'error', err.message);
    }
  }
}

/**
 * Run actions for a batch of newly categorized emails.
 */
export async function runActionsForBatch(emailCategoryPairs) {
  for (const { emailId, categoryId } of emailCategoryPairs) {
    await runActionsForEmail(emailId, categoryId).catch(err =>
      console.error(`[Action] Batch error for ${emailId}:`, err.message)
    );
  }
}

/**
 * Execute a single action.
 */
async function executeAction(type, config, email) {
  switch (type) {
    case 'skip':
      return 'skipped';

    case 'mark_read':
      db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').run(email.id);
      return 'marked read';

    case 'auto_tag': {
      const tagNames = config.tags || [];
      for (const name of tagNames) {
        let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
        if (!tag) {
          const tagId = uuidv4();
          db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(tagId, name, config.color || '#6366f1');
          tag = { id: tagId };
        }
        db.prepare('INSERT OR IGNORE INTO email_tags (email_id, tag_id) VALUES (?, ?)').run(email.id, tag.id);
      }
      return `tagged: ${tagNames.join(', ')}`;
    }

    case 'script': {
      const cmd = config.command;
      if (!cmd) throw new Error('No command configured');

      // Pass email as JSON on stdin via a temp approach:
      // Use shell with echo piped to the script
      const emailJson = JSON.stringify({
        id: email.id,
        subject: email.subject,
        sender_name: email.sender_name,
        sender_email: email.sender_email,
        recipients: email.recipients,
        date: email.date,
        snippet: email.snippet,
        body_text: email.body_text,
        body_html: email.body_html,
        category_name: email.category_name,
      });

      const timeout = config.timeout || 120000;
      // Use a temp file for stdin to avoid shell escaping issues with large HTML bodies
      const tmpFile = `/tmp/ecc-action-${email.id}.json`;
      const { writeFileSync, unlinkSync } = await import('fs');
      writeFileSync(tmpFile, emailJson);
      let stdout, stderr;
      try {
        const result = await execFileAsync('/bin/bash', ['-c', `cat '${tmpFile}' | ${cmd}`], {
          timeout,
          maxBuffer: 1024 * 1024,
          env: {
            ...process.env,
            EMAIL_ID: email.id,
            EMAIL_SUBJECT: email.subject || '',
            EMAIL_SENDER: email.sender_email || '',
            EMAIL_CATEGORY: email.category_name || '',
            EMAIL_DATE: email.date || '',
          },
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } finally {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
      }

      const output = (stdout || '').trim();
      if (stderr) console.warn(`[Action:script] stderr: ${stderr.slice(0, 200)}`);

      return output || 'executed';
    }

    case 'ai_prompt': {
      const prompt = config.prompt;
      if (!prompt) throw new Error('No prompt configured');

      const body = (email.body_text || email.snippet || '').slice(0, 6000);
      const userMessage = `Email:\nFrom: ${email.sender_name || ''} <${email.sender_email}>\nSubject: ${email.subject}\nDate: ${email.date}\n\n${body}`;

      const systemPrompt = prompt;
      const result = await getJSON(systemPrompt, userMessage, { maxTokens: 2000 });

      // Store the analysis result
      const output = JSON.stringify(result);
      return output;
    }

    case 'webhook': {
      const url = config.url;
      if (!url) throw new Error('No webhook URL configured');

      const payload = {
        email_id: email.id,
        subject: email.subject,
        sender_email: email.sender_email,
        sender_name: email.sender_name,
        date: email.date,
        snippet: email.snippet,
        category_name: email.category_name,
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.timeout || 10000),
      });

      return `${resp.status} ${resp.statusText}`;
    }

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

function logAction(actionId, emailId, status, output) {
  db.prepare(`
    INSERT INTO action_log (id, action_id, email_id, status, output)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), actionId, emailId, status, typeof output === 'string' ? output.slice(0, 5000) : JSON.stringify(output).slice(0, 5000));
}

/**
 * Get action log for an email.
 */
export function getActionLog(emailId) {
  return db.prepare(`
    SELECT al.*, ca.type AS action_type, ca.label AS action_label
    FROM action_log al
    JOIN category_actions ca ON al.action_id = ca.id
    WHERE al.email_id = ?
    ORDER BY al.created_at DESC
  `).all(emailId);
}

/**
 * Manually trigger all actions for an email (re-run).
 */
export async function rerunActionsForEmail(emailId) {
  const email = db.prepare('SELECT category_id FROM emails WHERE id = ?').get(emailId);
  if (!email?.category_id) return { ran: 0 };
  await runActionsForEmail(emailId, email.category_id);
  return { ran: 1 };
}
