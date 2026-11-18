const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function apiRequest<T>(endpoint: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }
  return response.json();
}

export interface Account {
  id: string;
  email: string;
  label: string;
  color: string;
  imap_user: string;
  last_uid: number;
  is_active: number;
  created_at: string;
  caldav_url: string | null;
  caldav_user: string | null;
}

export interface Email {
  id: string;
  account_id: string;
  uid: number;
  subject: string;
  sender_name: string;
  sender_email: string;
  recipients: string;       // JSON string
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  date: string;
  is_read: number;
  labels: string;           // JSON string
  tags: string | null;      // JSON array of Tag objects
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  paperless_id: number | null;
  gtd_task_id: number | null;
  account_label: string;
  account_color: string;
  account_email: string;
}

export interface CategoryRule {
  id: string;
  category_id: string;
  field: string;
  operator: string;
  value: string;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  behavior: 'always-summarize' | 'digest-only' | 'silent';
  sort_order: number;
  created_at: string;
  rules: CategoryRule[];
}

export interface RuleSuggestion {
  category: string;
  is_new_category: boolean;
  color?: string;
  behavior?: string;
  rule: { field: string; operator: string; value: string };
  reason: string;
  match_count: number;
}

export interface DigestGroup {
  id: string | null;
  name: string;
  color: string;
  behavior: string;
  count: number;
  unread: number;
  emails: { id: string; subject: string; sender_name: string; date: string; is_read: number; snippet: string | null }[];
}

export interface DigestResponse {
  period: string;
  from: string;
  total: number;
  groups: DigestGroup[];
}

export type ActionType = 'skip' | 'mark_read' | 'auto_tag' | 'script' | 'ai_prompt' | 'webhook';

export interface CategoryAction {
  id: string;
  category_id: string;
  type: ActionType;
  label: string;
  config: string; // JSON string
  sort_order: number;
  is_active: number;
  created_at: string;
}

export interface ActionLogEntry {
  id: string;
  action_id: string;
  email_id: string;
  status: 'success' | 'error';
  output: string | null;
  action_type: string;
  action_label: string;
  created_at: string;
}

export interface Tag {
  id: string | null;
  name: string;
  color: string;
}

export interface EmailsResponse {
  emails: Email[];
  total: number;
  limit: number;
  offset: number;
}

export interface CalendarEvent {
  id: string;
  account_id: string;
  uid: string;
  summary: string;
  description: string;
  location: string;
  dtstart: string;
  dtend: string | null;
  all_day: number;
  status: string | null;
  organizer: string | null;
  account_email: string;
  account_label: string;
  account_color: string;
}

export interface CalendarEventCount {
  day: string;
  count: number;
}

export interface DigestEventSummary {
  time: string;
  summary: string;
  location?: string;
}

export interface DailyDigestCategory {
  category_id: string | null;
  name: string;
  color: string;
  email_count: number;
  summary: string;
  top_subjects: string[];
}

export interface DigestActionItem {
  action: string;
  email_id: string;
  subject: string;
  sender: string;
}

export interface DailyDigestContent {
  events: DigestEventSummary[];
  categories: DailyDigestCategory[];
  uncategorized: { email_count: number; summary: string; top_subjects: string[] };
  highlights: string[];
  action_items: (DigestActionItem | string)[];
  headline: string;
}

export interface DailyDigest {
  id: string;
  date: string;
  status: 'none' | 'pending' | 'generating' | 'complete' | 'error';
  headline: string | null;
  content: DailyDigestContent | null;
  email_count: number;
  model: string | null;
  error_msg: string | null;
  generated_at: string | null;
  created_at: string;
}

export interface CalendarDay {
  date: string;
  email_count: number;
  digest_status: 'pending' | 'generating' | 'complete' | 'error' | null;
  headline: string | null;
}

export interface CalendarData {
  yearMonth: string;
  days: CalendarDay[];
}

export interface TodayBriefing {
  date: string
  arrived: number
  handled: number
  remaining: number
  summary: string | null
  highlights: TodayHighlight[]
  fyi: TodayFyi[]
  generatedAt: string | null
  digestStatus: 'generating' | 'complete' | 'error' | null
  digestError: string | null
}

export interface TodayHighlight {
  title: string
  body: string
  emailId: string | null
  kind: 'decision' | 'fyi'
}

export interface TodayFyi {
  title: string
  kind: 'auto' | 'light'
  count?: number
  emailId?: string
}

export interface MonthDayStatus {
  date: string
  status: 'today' | 'ready' | 'stale' | 'never' | 'weekend' | 'future'
  emailCount: number
  decisionCount: number
  generatedAt: string | null
}

export interface BackfillStatus {
  running: boolean;
  total: number;
  completed: number;
  current_date: string | null;
  errors: { date: string; error: string }[];
}

export interface SyncStatus {
  [accountId: string]: {
    running: boolean;
    lastSync: string | null;
    error: string | null;
    newCount: number;
  };
}

// --- Tasks / GTD ---

export type GtdColumn = 'inbox' | 'next' | 'wait' | 'some' | 'done';

export interface Task {
  id: number;
  title: string;
  notes: string;
  col: GtdColumn;
  due: string | null;
  ctx: string | null;
  completedAt: string | null;
  done: boolean;
  projectId: number;
  position: number;
  createdAt: string;
  updatedAt: string;
  labels: { id: number; title: string; color: string }[];
}

export interface VikunjaStatus {
  connected: boolean;
  instanceUrl?: string;
  error?: string;
}

export interface EmailClassification {
  actionable: boolean;
  list: 'next' | 'waiting' | 'someday' | 'inbox';
  title: string;
  dueHint: string | null;
}

export interface GtdHealth {
  score: number;
  trend: number;
  counts: { inbox: number; next: number; wait: number; some: number };
  processedThisWeek: number;
  warnings: { kind: string; text: string }[];
  praise: { kind: string; text: string }[];
  stale: { id: number; list: string; title: string; ageDays: number }[];
  waitingFor: { id: number; title: string; who: string; sinceDays: number; nudged: string | null; email: string }[];
  inboxToProcess: { id: number; title: string; src: 'email' | 'manual'; notes?: string }[];
}

export interface VagueTask {
  taskId: number;
  currentTitle: string;
  issue: string;
}

// --- Triage ---

export interface TriageCriterion { answer: boolean; evidence: string; evidence_found: boolean | null }

export interface TriageResult {
  email_id: string;
  score: number;
  rule_score: number;
  ai_score: number;
  matched_rules: string;  // JSON string of matched rule objects
  action_type: string;
  reason: string | null;
  suggested_task: string | null;
  status?: 'evaluated' | 'not_evaluated';
  important?: 0 | 1 | null;
  criteria?: string | null;  // JSON string, see TriageCriterion (card #239)
  prompt_version?: string | null;
  model?: string | null;
  triage_at: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  date: string;
  snippet: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  is_read: number;
  gtd_task_id: number | null;
  feedback_decision: string | null;
}

export interface TriagePromptPreview {
  system: string;
  context: string;
  sample: string;
  feedbackExamples: { sender_email: string; subject: string; decision: string; triage_score: number | null; triage_action: string | null; reason: string | null; category_name: string | null }[];
  stats: { totalFeedback: number; totalTriaged: number };
}

export interface TriageFeedbackEntry {
  id: string;
  email_id: string;
  decision: string;
  reason: string | null;
  triage_score: number | null;
  triage_action: string | null;
  created_at: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  category_name: string | null;
}

export interface TriageBacktestResult {
  tested: number;
  matches: number;
  mismatches: number;
  results: {
    email_id: string;
    subject: string;
    sender_email: string;
    category_name: string | null;
    old_score: number | null;
    new_score: number | null;
    user_decision: string;
    would_match: boolean;
    reason: string | null;
  }[];
}

export interface ScoringRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  score: number;
  action_type: string | null;
  label: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface ScoringRuleTestResult {
  email_id: string;
  subject: string;
  sender_email: string;
  category_name: string | null;
  rule_score: number;
  matched_rules: { id: string; label: string; score: number }[];
  rule_action_type: string | null;
}

export interface PipelineStep {
  id: string;
  name: string;
  type: 'enricher' | 'scorer' | 'action';
  is_active: number;
  sort_order: number;
  config: Record<string, unknown>;
  created_at: string;
}

export interface PipelineStatus {
  total: number;
  totalEmails: number;
  completed: number;
  errors: number;
  inProgress: number;
  unenriched: number;
  lastRun: string | null;
  steps: PipelineStep[];
  recentErrors: { sender_email: string; subject: string; error: string }[];
}

export interface EmailEnrichment {
  email_id: string;
  data: Record<string, unknown>;
  steps_run: string[];
  pipeline_version: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export interface TriagePreferences {
  instructions: string;
  learnedProfile: string;
  enabled: boolean;
  stats: { decision: string; count: number }[];
  evaluation?: { total: number; notEvaluated: number | null; lastFailureAt: string | null; lastError: string | null };
}

export const TASK_COLUMNS = [
  { id: 'inbox' as const, label: 'Inbox',       kicker: 'capture',  hint: 'Process me' },
  { id: 'next'  as const, label: 'Next Action',  kicker: 'do',       hint: 'Concrete · doable' },
  { id: 'wait'  as const, label: 'Waiting For',  kicker: 'track',    hint: 'Blocked on others' },
  { id: 'some'  as const, label: 'Someday',      kicker: 'parking',  hint: 'Maybe · not now' },
  { id: 'done'  as const, label: 'Completed',    kicker: 'archive',  hint: 'Last 7 days' },
] as const;

export const TASK_CONTEXTS = [
  { id: 'home',   label: '@home',   color: 'oklch(0.72 0.13 155)' },
  { id: 'work',   label: '@work',   color: 'oklch(0.72 0.14 250)' },
  { id: 'calls',  label: '@calls',  color: 'oklch(0.78 0.14 75)' },
  { id: 'errand', label: '@errand', color: 'oklch(0.72 0.14 300)' },
  { id: 'read',   label: '@read',   color: 'oklch(0.68 0.08 80)' },
] as const;

export const api = {
  // Accounts
  getAccounts: () => apiRequest<Account[]>('/accounts'),
  addAccount: (data: { email: string; label?: string; color?: string; imap_user: string; imap_pass: string }) =>
    apiRequest<Account>('/accounts', { method: 'POST', body: data }),
  updateAccount: (id: string, data: Partial<Account>) =>
    apiRequest<Account>(`/accounts/${id}`, { method: 'PATCH', body: data }),
  deleteAccount: (id: string) =>
    apiRequest<{ success: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),

  // Emails
  getEmails: (params?: { account_id?: string; category_id?: string; limit?: number; offset?: number; unread_only?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.account_id) q.set('account_id', params.account_id);
    if (params?.category_id) q.set('category_id', params.category_id);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.unread_only) q.set('unread_only', 'true');
    return apiRequest<EmailsResponse>(`/emails?${q}`);
  },
  getEmail: (id: string) => apiRequest<Email>(`/emails/${id}`),
  deleteEmail: (id: string) => apiRequest<{ success: boolean }>(`/emails/${id}`, { method: 'DELETE' }),
  markRead: (id: string, read = true) =>
    apiRequest<{ success: boolean }>(`/emails/${id}/read`, { method: 'POST', body: { read } }),
  searchEmails: (q: string) => apiRequest<{ emails: Email[] }>(`/emails/search?q=${encodeURIComponent(q)}`),

  // Categories
  getCategories: () => apiRequest<Category[]>('/categories'),
  createCategory: (data: { name: string; color: string; behavior: string }) =>
    apiRequest<Category>('/categories', { method: 'POST', body: data }),
  updateCategory: (id: string, data: Partial<Category>) =>
    apiRequest<Category>(`/categories/${id}`, { method: 'PATCH', body: data }),
  deleteCategory: (id: string) =>
    apiRequest<{ success: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
  addCategoryRule: (categoryId: string, rule: { field: string; operator: string; value: string }) =>
    apiRequest<CategoryRule>(`/categories/${categoryId}/rules`, { method: 'POST', body: rule }),
  deleteCategoryRule: (ruleId: string) =>
    apiRequest<{ success: boolean }>(`/categories/rules/${ruleId}`, { method: 'DELETE' }),
  applyCategories: () =>
    apiRequest<{ success: boolean; count: number }>('/categories/apply', { method: 'POST' }),
  suggestRules: (sampleSize?: number) =>
    apiRequest<{ suggestions: RuleSuggestion[]; uncategorized_total: number }>('/categories/suggest-rules', { method: 'POST', body: { sample_size: sampleSize ?? 50 } }),
  previewCategories: () =>
    apiRequest<{ total: number; uncategorized_count: number; categories: { id: string; name: string; color: string; behavior: string; count: number }[] }>('/categories/preview'),
  previewEmails: (group: string, search?: string, limit?: number, offset?: number) => {
    const q = new URLSearchParams({ group, search: search || '', limit: String(limit || 100), offset: String(offset || 0) })
    return apiRequest<{ total: number; emails: { id: string; sender_name: string; sender_email: string; subject: string; date: string; snippet: string | null }[] }>(`/categories/preview/emails?${q}`)
  },
  getDigest: (period: '1d' | '7d' | '30d') =>
    apiRequest<DigestResponse>(`/categories/digest?period=${period}`),

  // Tags
  getTags: () => apiRequest<Tag[]>('/tags'),
  createTag: (name: string, color?: string) =>
    apiRequest<Tag>('/tags', { method: 'POST', body: { name, color } }),
  deleteTag: (id: string) =>
    apiRequest<{ success: boolean }>(`/tags/${id}`, { method: 'DELETE' }),
  getEmailTags: (emailId: string) => apiRequest<Tag[]>(`/tags/email/${emailId}`),
  addEmailTag: (emailId: string, tagId: string) =>
    apiRequest<{ success: boolean }>(`/tags/email/${emailId}`, { method: 'POST', body: { tag_id: tagId } }),
  removeEmailTag: (emailId: string, tagId: string) =>
    apiRequest<{ success: boolean }>(`/tags/email/${emailId}/${tagId}`, { method: 'DELETE' }),
  suggestTags: (emailId: string) => apiRequest<Tag[]>(`/tags/suggest/${emailId}`),

  // Sync
  getSyncStatus: () => apiRequest<SyncStatus>('/sync/status'),
  triggerSync: (account_id?: string) =>
    apiRequest<{ triggered: number }>('/sync/trigger', { method: 'POST', body: { account_id } }),

  // Daily Digests — New endpoints
  getTodayBriefing: () =>
    apiRequest<TodayBriefing>('/daily-digests/today'),
  getMonthStatus: (year: number, month: number) =>
    apiRequest<MonthDayStatus[]>(`/daily-digests/month-status?year=${year}&month=${month}`),

  // Daily Digests — Existing
  getDailyDigestCalendar: (yearMonth: string) =>
    apiRequest<CalendarData>(`/daily-digests/calendar/${yearMonth}`),
  getDailyDigest: (date: string) =>
    apiRequest<DailyDigest>(`/daily-digests/${date}`),
  generateDailyDigest: (date: string, force?: boolean) =>
    apiRequest<DailyDigest>(`/daily-digests/${date}/generate${force ? '?force=1' : ''}`, { method: 'POST' }),
  startBackfill: (from: string, to: string) =>
    apiRequest<{ queued: number; already_complete: number }>('/daily-digests/backfill', { method: 'POST', body: { from, to } }),
  getBackfillStatus: () =>
    apiRequest<BackfillStatus>('/daily-digests/backfill/status'),

  // Category Actions
  getCategoryActions: (categoryId: string) =>
    apiRequest<CategoryAction[]>(`/category-actions/${categoryId}`),
  addCategoryAction: (categoryId: string, data: { type: ActionType; label?: string; config?: Record<string, unknown>; sort_order?: number }) =>
    apiRequest<CategoryAction>(`/category-actions/${categoryId}`, { method: 'POST', body: data }),
  updateCategoryAction: (actionId: string, data: Partial<{ label: string; config: Record<string, unknown>; sort_order: number; is_active: boolean }>) =>
    apiRequest<CategoryAction>(`/category-actions/action/${actionId}`, { method: 'PATCH', body: data }),
  deleteCategoryAction: (actionId: string) =>
    apiRequest<{ success: boolean }>(`/category-actions/action/${actionId}`, { method: 'DELETE' }),
  getActionLog: (emailId: string) =>
    apiRequest<ActionLogEntry[]>(`/category-actions/log/${emailId}`),
  rerunActions: (emailId: string) =>
    apiRequest<{ ran: number }>(`/category-actions/rerun/${emailId}`, { method: 'POST' }),

  // Calendar Events
  getCalendarEvents: (date: string) =>
    apiRequest<CalendarEvent[]>(`/calendar-events?date=${date}`),
  getCalendarEventsRange: (from: string, to: string) =>
    apiRequest<CalendarEvent[]>(`/calendar-events?from=${from}&to=${to}`),
  getCalendarEventCounts: (yearMonth: string) =>
    apiRequest<CalendarEventCount[]>(`/calendar-events/calendar/${yearMonth}`),
  syncCalendarEvents: () =>
    apiRequest<{ success: boolean }>('/calendar-events/sync', { method: 'POST' }),
  testCalDAV: (url: string, username: string, password: string) =>
    apiRequest<{ ok: boolean; calendarCount: number }>('/calendar-events/test', { method: 'POST', body: { url, username, password } }),

  // Tasks (Vikunja GTD)
  getTasks: () => apiRequest<Task[]>('/tasks'),
  createTask: (data: { title: string; notes?: string; due?: string; ctx?: string; col?: GtdColumn; projectId?: number }) =>
    apiRequest<Task>('/tasks', { method: 'POST', body: data }),
  updateTask: (id: number, data: Partial<{ title: string; notes: string; due: string | null; ctx: string | null; col: GtdColumn }>) =>
    apiRequest<Task>(`/tasks/${id}`, { method: 'PATCH', body: data }),
  deleteTask: (id: number) =>
    apiRequest<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  getVikunjaStatus: () => apiRequest<VikunjaStatus>('/tasks/status'),

  // GTD AI features
  classifyEmail: (emailId: string) =>
    apiRequest<EmailClassification>('/tasks/classify-email', { method: 'POST', body: { emailId } }),
  createTaskFromEmail: (emailId: string, overrides: { title: string; col?: GtdColumn; ctx?: string; due?: string }) =>
    apiRequest<{ task: Task; emailId: string }>('/tasks/from-email', { method: 'POST', body: { emailId, ...overrides } }),
  suggestTaskTitle: (partial_title: string) =>
    apiRequest<{ rewrites: string[] }>('/tasks/suggest', { method: 'POST', body: { partial_title } }),
  improveTaskTitle: (title: string) =>
    apiRequest<{ rewrites: string[] }>('/tasks/improve', { method: 'POST', body: { title } }),

  // GTD Pulse
  getGtdHealth: () => apiRequest<GtdHealth>('/tasks/health'),
  getVagueTasks: (ai?: boolean) =>
    apiRequest<{ suggestions: VagueTask[] }>(`/tasks/vague${ai ? '?ai=true' : ''}`),
  draftNudge: (data: { title: string; who: string; sinceDays: number }) =>
    apiRequest<{ text: string }>('/tasks/nudge', { method: 'POST', body: data }),
  completeReview: () =>
    apiRequest<{ success: boolean; score: number }>('/tasks/review/complete', { method: 'POST' }),

  // Triage
  getTriageResults: (params?: { min_score?: number; limit?: number; offset?: number; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.min_score != null) q.set('min_score', String(params.min_score));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.date) q.set('date', params.date);
    return apiRequest<{ results: TriageResult[]; total: number }>(`/triage?${q}`);
  },
  runTriage: (emailIds?: string[]) =>
    apiRequest<{ triaged: number }>('/triage/run', { method: 'POST', body: emailIds ? { emailIds } : {} }),
  submitTriageFeedback: (emailId: string, decision: 'approve' | 'dismiss' | 'create_task', reason?: string) =>
    apiRequest<{ success: boolean }>(`/triage/${emailId}/feedback`, { method: 'POST', body: { decision, reason } }),
  getTriagePreferences: () =>
    apiRequest<TriagePreferences>('/triage/preferences'),
  updateTriagePreferences: (data: { instructions?: string; enabled?: boolean }) =>
    apiRequest<{ success: boolean }>('/triage/preferences', { method: 'PUT', body: data }),
  summarizeTriagePreferences: () =>
    apiRequest<{ success: boolean; profile: string }>('/triage/summarize-preferences', { method: 'POST' }),
  getTriagePromptPreview: (sampleSize?: number) =>
    apiRequest<TriagePromptPreview>(`/triage/prompt-preview${sampleSize ? `?sample_size=${sampleSize}` : ''}`),
  getTriageFeedbackHistory: (params?: { limit?: number; offset?: number; decision?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.decision) q.set('decision', params.decision);
    if (params?.search) q.set('search', params.search);
    return apiRequest<{ decisions: TriageFeedbackEntry[]; total: number }>(`/triage/feedback-history?${q}`);
  },
  flipTriageFeedback: (feedbackId: string, decision: string) =>
    apiRequest<{ success: boolean }>(`/triage/feedback/${feedbackId}/flip`, { method: 'POST', body: { decision } }),
  runTriageBacktest: (data: { instructions?: string; learnedProfile?: string; limit?: number }) =>
    apiRequest<TriageBacktestResult>('/triage/backtest', { method: 'POST', body: data }),

  // Scoring Rules
  getScoringRules: () =>
    apiRequest<{ rules: ScoringRule[] }>('/triage/scoring-rules'),
  createScoringRule: (data: { field: string; operator: string; value: string; score: number; action_type?: string; label?: string }) =>
    apiRequest<ScoringRule>('/triage/scoring-rules', { method: 'POST', body: data }),
  updateScoringRule: (id: string, data: Partial<ScoringRule>) =>
    apiRequest<ScoringRule>(`/triage/scoring-rules/${id}`, { method: 'PATCH', body: data }),
  deleteScoringRule: (id: string) =>
    apiRequest<{ success: boolean }>(`/triage/scoring-rules/${id}`, { method: 'DELETE' }),
  testScoringRules: (limit?: number) =>
    apiRequest<{ results: ScoringRuleTestResult[] }>('/triage/scoring-rules/test', { method: 'POST', body: { limit: limit || 20 } }),

  // Pipeline
  getPipelineSteps: () =>
    apiRequest<{ steps: PipelineStep[] }>('/pipeline/steps'),
  updatePipelineStep: (id: string, data: Partial<{ is_active: boolean; sort_order: number; config: Record<string, unknown> }>) =>
    apiRequest<PipelineStep>(`/pipeline/steps/${id}`, { method: 'PATCH', body: data }),
  getEmailEnrichment: (emailId: string) =>
    apiRequest<EmailEnrichment>(`/pipeline/enrichments/${emailId}`),
  runPipeline: (params?: { emailIds?: string[]; days?: number }) =>
    apiRequest<{ queued: number }>('/pipeline/run', { method: 'POST', body: params || {} }),
  getPipelineStatus: () =>
    apiRequest<PipelineStatus>('/pipeline/status'),
};
