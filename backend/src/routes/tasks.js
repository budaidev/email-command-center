import { Router } from 'express';
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  getConnectionStatus,
} from '../services/vikunja.js';
import { getJSON } from '../services/llm.js';
import db from '../db.js';
import {
  SYSTEM as CLASSIFY_SYSTEM,
  buildUserMessage as classifyMsg,
} from '../prompts/classify-email-task.js';
import {
  SYSTEM as IMPROVE_SYSTEM,
  buildUserMessage as improveMsg,
} from '../prompts/improve-task.js';
import {
  SYSTEM as NUDGE_SYSTEM,
  buildUserMessage as nudgeMsg,
} from '../prompts/nudge-waiting.js';

const router = Router();

/* ─── Vague task detection heuristic (ported from GAP) ─── */

const ACTION_VERBS = /^(call|email|send|write|review|read|buy|get|pick up|schedule|book|attend|meet|discuss|ask|tell|confirm|check|verify|update|create|draft|prepare|research|find|look up|download|upload|install|fix|repair|clean|organize|file|submit|apply|register|cancel|return|exchange|pay|transfer|deposit|order|ship|deliver|print|copy|scan|sign|complete|finish|start|begin|continue|follow up|respond|reply|contact|reach out|set up|configure|test|debug|deploy|push|merge|commit|approve|reject|decide|plan|outline|brainstorm|list|prioritize|delegate|assign|train|teach|learn|study|practice|exercise|cook|make|build|assemble|pack|move|arrange|sort|label|tag|archive|backup|restore|renew|extend|upgrade|counter|block|choose|request|post|publish|record|watch|open|close|delete)/i;

function analyzeTask(title) {
  const words = title.trim().split(/\s+/);

  if (words.length <= 2 && !ACTION_VERBS.test(title)) {
    return { vague: true, issue: 'Too brief — add action verb and details' };
  }
  if (/^(handle|deal with|look into|think about|consider|work on|do something|figure out|sort out|take care of|look at|check on|explore)\b/i.test(title)) {
    return { vague: true, issue: 'Weak verb — start with a concrete action' };
  }
  if (words.length <= 3 && !ACTION_VERBS.test(title) && !/\?/.test(title)) {
    if (/^(the |a |my |our |their )?[a-z]+( [a-z]+)?$/i.test(title)) {
      return { vague: true, issue: 'Missing action verb — what do you need to DO?' };
    }
  }
  if (/\?/.test(title) && words.length < 5) {
    return { vague: true, issue: 'Question needs to become an action' };
  }
  if (words.length === 1 && !ACTION_VERBS.test(title)) {
    return { vague: true, issue: 'Single word — needs context and action' };
  }
  if (/\.\.\.|etc\.?$/i.test(title)) {
    return { vague: true, issue: 'Incomplete — specify all items' };
  }
  return { vague: false };
}

/* ─── Health scoring ─── */

function computeHealth(tasks) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const inbox = tasks.filter(t => t.col === 'inbox' && !t.done);
  const next = tasks.filter(t => t.col === 'next' && !t.done);
  const wait = tasks.filter(t => t.col === 'wait' && !t.done);
  const some = tasks.filter(t => t.col === 'some' && !t.done);

  const overdue = tasks.filter(t => t.due && t.due < today && !t.done);
  const stale = tasks.filter(t => {
    if (t.done || (t.col !== 'next' && t.col !== 'wait')) return false;
    if (!t.updatedAt) return false;
    return new Date(t.updatedAt) < fourteenDaysAgo;
  });

  const processedThisWeek = tasks.filter(t => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt + 'T00:00:00') >= sevenDaysAgo;
  }).length;

  // Score: 100 - penalties
  let score = 100;
  score -= inbox.length * 2;
  score -= Math.max(0, next.length - 30);
  score -= overdue.length * 5;
  score -= stale.length * 2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Warnings
  const warnings = [];
  if (inbox.length > 3) {
    warnings.push({ kind: 'warn', text: `Inbox at ${inbox.length} — process before it piles up` });
  }
  if (next.length > 30) {
    warnings.push({ kind: 'warn', text: `Next Actions has ${next.length} items (recommended <30)` });
  }
  if (overdue.length > 0) {
    warnings.push({ kind: 'warn', text: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}` });
  }
  if (stale.length > 0) {
    warnings.push({ kind: 'warn', text: `${stale.length} task${stale.length > 1 ? 's' : ''} stale > 14 days` });
  }

  // Praise
  const praise = [];
  if (inbox.length <= 3) praise.push({ kind: 'ok', text: 'Inbox is nearly empty — great processing' });
  if (overdue.length === 0) praise.push({ kind: 'ok', text: 'No overdue tasks' });
  if (stale.length === 0) praise.push({ kind: 'ok', text: 'All Next Actions are fresh and active' });
  if (processedThisWeek >= 8) praise.push({ kind: 'ok', text: `Processing rate up — ${processedThisWeek} tasks/wk` });

  // Trend (diff vs last snapshot)
  let trend = 0;
  try {
    const lastSnapshot = db.prepare(
      `SELECT score FROM gtd_health_snapshots ORDER BY created_at DESC LIMIT 1`
    ).get();
    if (lastSnapshot) trend = score - lastSnapshot.score;
  } catch (err) {
    console.warn('[Health] Failed to read trend from snapshots:', err.message);
  }

  // Waiting-for details
  const waitingFor = wait.map(t => {
    const sinceDays = t.updatedAt
      ? Math.floor((now.getTime() - new Date(t.updatedAt).getTime()) / 86400000)
      : 0;
    // Try to extract "who" from title (pattern: "Person — thing" or "Person: thing")
    const whoMatch = t.title.match(/^([^—:–]+)[—:–]/);
    const who = whoMatch ? whoMatch[1].trim() : '';
    return { id: t.id, title: t.title, who, sinceDays, nudged: null, email: '' };
  });

  // Stale details
  const staleDetails = stale.map(t => {
    const ageDays = t.updatedAt
      ? Math.floor((now.getTime() - new Date(t.updatedAt).getTime()) / 86400000)
      : 0;
    return { id: t.id, list: t.col, title: t.title, ageDays };
  });

  // Inbox items with source
  const emailTaskIds = new Set();
  try {
    const linked = db.prepare('SELECT gtd_task_id FROM emails WHERE gtd_task_id IS NOT NULL').all();
    linked.forEach(r => emailTaskIds.add(r.gtd_task_id));
  } catch (err) {
    console.warn('[Health] Failed to read email-task links:', err.message);
  }

  const inboxToProcess = inbox.map(t => ({
    id: t.id,
    title: t.title,
    src: emailTaskIds.has(t.id) ? 'email' : 'manual',
  }));

  return {
    score,
    trend,
    counts: { inbox: inbox.length, next: next.length, wait: wait.length, some: some.length, overdue: overdue.length, stale: stale.length },
    processedThisWeek,
    warnings,
    praise,
    stale: staleDetails,
    waitingFor,
    inboxToProcess,
  };
}

/* ─── Static routes (must be before /:id) ─── */

// GET /api/tasks/status — Vikunja connection status
router.get('/status', async (_req, res, next) => {
  try {
    const status = await getConnectionStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/health — Full GTD pulse data
router.get('/health', async (_req, res, next) => {
  try {
    const tasks = await getAllTasks();
    const health = computeHealth(tasks);
    res.json(health);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/vague — Server-side vague detection with optional AI
router.get('/vague', async (req, res, next) => {
  try {
    const tasks = await getAllTasks();
    const toCheck = tasks.filter(t => !t.done && (t.col === 'inbox' || t.col === 'next'));

    const suggestions = [];
    for (const task of toCheck) {
      const analysis = analyzeTask(task.title);
      if (analysis.vague) {
        suggestions.push({
          taskId: task.id,
          currentTitle: task.title,
          issue: analysis.issue,
        });
      }
    }

    // Optional AI pass for borderline tasks (short titles that passed heuristic)
    if (req.query.ai === 'true') {
      const borderline = toCheck.filter(t => {
        const words = t.title.trim().split(/\s+/);
        return !analyzeTask(t.title).vague && words.length < 6 && !ACTION_VERBS.test(t.title);
      }).slice(0, 5);

      if (borderline.length > 0) {
        try {
          const result = await getJSON(
            'Identify which of these task titles are vague or unclear. Return JSON: {"vague": [{"title": "...", "issue": "..."}]}',
            borderline.map(t => t.title).join('\n'),
          );
          if (result?.vague) {
            for (const v of result.vague) {
              const match = borderline.find(t => t.title === v.title);
              if (match && !suggestions.find(s => s.taskId === match.id)) {
                suggestions.push({ taskId: match.id, currentTitle: match.title, issue: v.issue || 'AI flagged as unclear' });
              }
            }
          }
        } catch (err) {
          console.warn('[Vague] AI pass failed:', err.message);
        }
      }
    }

    res.json({ suggestions: suggestions.slice(0, 15) });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/classify-email — AI email → task classification
router.post('/classify-email', async (req, res, next) => {
  try {
    const { emailId } = req.body;
    if (!emailId) return res.status(400).json({ error: 'emailId is required' });

    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
    if (!email) return res.status(404).json({ error: 'Email not found' });

    // Fetch cached summary if available
    let summary = null;
    try {
      const row = db.prepare('SELECT content FROM summaries WHERE email_id = ?').get(emailId);
      if (row?.content) summary = row.content;
    } catch {}

    const result = await getJSON(CLASSIFY_SYSTEM, classifyMsg(email, summary));
    // Normalize LLM list values to ECC column keys
    if (result?.list) {
      const normalize = { waiting: 'wait', someday: 'some' };
      result.list = normalize[result.list] || result.list;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/from-email — Create task + link to email
router.post('/from-email', async (req, res, next) => {
  try {
    const { emailId, title, col, ctx, due } = req.body;
    if (!emailId || !title) {
      return res.status(400).json({ error: 'emailId and title are required' });
    }

    const email = db.prepare('SELECT subject, sender_name, sender_email, date, gtd_task_id FROM emails WHERE id = ?').get(emailId);
    if (!email) return res.status(404).json({ error: 'Email not found' });
    if (email.gtd_task_id) return res.status(409).json({ error: 'Email already linked to a task', taskId: email.gtd_task_id });

    const notes = `Re: ${email.subject}\nFrom: ${email.sender_name || ''} <${email.sender_email}>\n${email.date}`;
    const task = await createTask({ title, notes, due, ctx, col: col || 'inbox' });

    db.prepare('UPDATE emails SET gtd_task_id = ? WHERE id = ?').run(task.id, emailId);

    res.status(201).json({ task, emailId });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/suggest — Complete partial input into 3 tasks
router.post('/suggest', async (req, res, next) => {
  try {
    const { partial_title } = req.body;
    if (!partial_title) return res.status(400).json({ error: 'partial_title is required' });

    const result = await getJSON(IMPROVE_SYSTEM, `Complete this partial thought into 3 actionable tasks:\n"${partial_title}"`);
    res.json({ rewrites: result?.rewrites || result?.suggestions || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/improve — Rewrite vague title
router.post('/improve', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const result = await getJSON(IMPROVE_SYSTEM, improveMsg(title));
    res.json({ rewrites: result?.rewrites || result?.suggestions || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/nudge — AI nudge draft (no sending)
router.post('/nudge', async (req, res, next) => {
  try {
    const { title, who, sinceDays } = req.body;
    if (!title || !who) return res.status(400).json({ error: 'title and who are required' });

    const result = await getJSON(NUDGE_SYSTEM, nudgeMsg(title, who, sinceDays || 0));
    res.json({ text: result?.text || '' });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/review/complete — Mark weekly review done, save snapshot
router.post('/review/complete', async (_req, res, next) => {
  try {
    const tasks = await getAllTasks();
    const health = computeHealth(tasks);

    db.prepare(`
      INSERT INTO gtd_health_snapshots (score, counts, warnings)
      VALUES (?, ?, ?)
    `).run(
      health.score,
      JSON.stringify(health.counts),
      JSON.stringify(health.warnings),
    );

    res.json({ success: true, score: health.score });
  } catch (err) {
    next(err);
  }
});

/* ─── Core CRUD ─── */

// GET /api/tasks — all tasks for GTD board
router.get('/', async (_req, res, next) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks — create a new task
router.post('/', async (req, res, next) => {
  try {
    const { title, notes, due, ctx, col, projectId } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const task = await createTask({ title, notes, due, ctx, col, projectId });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id — update a task (col change = DnD move)
router.patch('/:id', async (req, res, next) => {
  try {
    const task = await updateTask(Number(req.params.id), req.body);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteTask(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
