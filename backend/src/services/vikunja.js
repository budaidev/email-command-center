/**
 * Vikunja API client — thin proxy for GTD task management.
 *
 * GTD column is derived from Vikunja project_id:
 *   Project 1 → inbox    (capture)
 *   Project 2 → next     (do)
 *   Project 4 → wait     (tracking)
 *   Project 5 → some     (someday/maybe)
 *   done      → Vikunja's native `done` flag
 *
 * Local overrides (task_columns table) take precedence when present,
 * allowing drag-drop moves without changing Vikunja projects.
 *
 * Context (@home, @work, etc.) comes from Vikunja labels or local overrides.
 */

import db from '../db.js';

function getConfig() {
  return {
    url: process.env.VIKUNJA_URL,
    token: process.env.VIKUNJA_TOKEN,
  };
}

/** Map Vikunja project_id to GTD column */
const PROJECT_TO_COL = {
  1: 'inbox',
  2: 'next',
  4: 'wait',
  5: 'some',
};

/** Projects to exclude from GTD board (references, project-specific, automated) */
const EXCLUDED_PROJECTS = new Set([3, 6, 7]);

/** Reverse: GTD column to the Vikunja project it should live in */
const COL_TO_PROJECT = {
  inbox: 1,
  next:  2,
  wait:  4,
  some:  5,
};

async function vFetch(path, opts = {}) {
  const { url, token } = getConfig();
  const { method = 'GET', body } = opts;
  const res = await fetch(`${url}/api/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Vikunja ${method} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204 || method === 'DELETE') {
    return { ok: true };
  }
  return res.json();
}

/** Get local override for column + context (returns null if no override) */
function getLocalOverride(taskId) {
  return db.prepare('SELECT gtd_column, context FROM task_columns WHERE vikunja_task_id = ?').get(taskId) || null;
}

/** Set a local column override for a task */
function setLocalColumn(taskId, col) {
  db.prepare(`
    INSERT INTO task_columns (vikunja_task_id, gtd_column, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(vikunja_task_id) DO UPDATE SET gtd_column = excluded.gtd_column, updated_at = excluded.updated_at
  `).run(taskId, col);
}

/** Set a local context override for a task */
function setLocalContext(taskId, ctx) {
  db.prepare(`
    INSERT INTO task_columns (vikunja_task_id, context, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(vikunja_task_id) DO UPDATE SET context = excluded.context, updated_at = excluded.updated_at
  `).run(taskId, ctx);
}

/** Determine which GTD column a task belongs to */
function resolveColumn(task) {
  if (task.done) return 'done';

  // Local override takes precedence
  const override = getLocalOverride(task.id);
  if (override?.gtd_column) return override.gtd_column;

  // Derive from Vikunja project_id
  return PROJECT_TO_COL[task.project_id] || 'inbox';
}

/** Extract context: local override > Vikunja @-labels > null */
function resolveContext(task) {
  const override = getLocalOverride(task.id);
  if (override?.context) return override.context;

  const labels = task.labels || [];
  for (const l of labels) {
    if (l.title.startsWith('@')) return l.title;
  }
  return null;
}

/** Map Vikunja task to our frontend shape */
function mapTask(task) {
  return {
    id: task.id,
    title: task.title,
    notes: task.description || '',
    col: resolveColumn(task),
    due: task.due_date && task.due_date !== '0001-01-01T00:00:00Z'
      ? task.due_date.split('T')[0]
      : null,
    ctx: resolveContext(task),
    completedAt: task.done_at && task.done_at !== '0001-01-01T00:00:00Z'
      ? task.done_at.split('T')[0]
      : null,
    done: task.done,
    projectId: task.project_id,
    position: task.position,
    createdAt: task.created,
    updatedAt: task.updated,
    labels: (task.labels || []).map(l => ({ id: l.id, title: l.title, color: l.hex_color })),
  };
}

/**
 * Get all tasks for the GTD board.
 * Filters out tasks completed more than 7 days ago.
 */
export async function getAllTasks() {
  let allTasks = [];
  let page = 1;
  while (true) {
    const batch = await vFetch(`/tasks/all?per_page=50&page=${page}`);
    allTasks = allTasks.concat(batch);
    if (batch.length < 50) break;
    page++;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  return allTasks
    .filter(t => !EXCLUDED_PROJECTS.has(t.project_id))
    .map(mapTask)
    .filter(t => {
      if (t.done && t.completedAt) {
        const doneDate = new Date(t.completedAt + 'T00:00:00');
        if (doneDate < sevenDaysAgo) return false;
      }
      return true;
    });
}

/** Create a new task */
export async function createTask({ title, notes, due, ctx, col, projectId }) {
  const targetCol = col || 'inbox';
  // Place in the Vikunja project that matches the column
  const pid = projectId || COL_TO_PROJECT[targetCol] || 1;

  const body = { title, description: notes || '' };
  if (due) body.due_date = due + 'T00:00:00Z';

  const created = await vFetch(`/projects/${pid}/tasks`, {
    method: 'PUT',
    body,
  });

  if (ctx) setLocalContext(created.id, ctx);

  if (targetCol === 'done') {
    await vFetch(`/tasks/${created.id}`, { method: 'POST', body: { done: true } });
  }

  const full = await vFetch(`/tasks/${created.id}`);
  return mapTask(full);
}

/** Update a task (title, notes, due, col change, ctx change) */
export async function updateTask(taskId, updates) {
  const body = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.notes !== undefined) body.description = updates.notes;
  if (updates.due !== undefined) {
    body.due_date = updates.due ? updates.due + 'T00:00:00Z' : '0001-01-01T00:00:00Z';
  }

  if (updates.col !== undefined) {
    if (updates.col === 'done') {
      body.done = true;
    } else {
      const currentTask = await vFetch(`/tasks/${taskId}`);
      if (currentTask.done) body.done = false;

      // Try to move to the matching Vikunja project
      const targetProject = COL_TO_PROJECT[updates.col];
      if (targetProject && currentTask.project_id !== targetProject) {
        body.project_id = targetProject;
      }
    }
    // Store local override in case project move doesn't stick
    setLocalColumn(taskId, updates.col);
  }

  if (updates.ctx !== undefined) {
    setLocalContext(taskId, updates.ctx);
  }

  if (Object.keys(body).length > 0) {
    await vFetch(`/tasks/${taskId}`, { method: 'POST', body });
  }

  const full = await vFetch(`/tasks/${taskId}`);
  return mapTask(full);
}

/** Delete a task */
export async function deleteTask(taskId) {
  await vFetch(`/tasks/${taskId}`, { method: 'DELETE' });
  db.prepare('DELETE FROM task_columns WHERE vikunja_task_id = ?').run(taskId);
  return { ok: true };
}

/** Check connection status */
export async function getConnectionStatus() {
  try {
    const { url, token } = getConfig();
    if (!url || !token) {
      return { connected: false, error: 'VIKUNJA_URL or VIKUNJA_TOKEN not configured' };
    }
    await vFetch('/tasks/all?per_page=1');
    return { connected: true, instanceUrl: url };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
