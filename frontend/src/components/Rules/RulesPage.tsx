import { useState, useEffect, useCallback } from 'react'
import { Plus, X, RefreshCw, Check, ChevronDown, ChevronRight, Search, Zap, Wand2, Loader2, CheckCircle2, PlusCircle, Play, Terminal, Brain, Tag, Globe, EyeOff, MailOpen, Trash2 } from 'lucide-react'
import { api, Category, CategoryRule, CategoryAction, ActionType, RuleSuggestion } from '../../api/client'

const FIELDS = [
  { value: 'sender_email',    label: 'Sender email' },
  { value: 'sender_domain',   label: 'Sender domain' },
  { value: 'sender_name',     label: 'Sender name' },
  { value: 'subject',         label: 'Subject' },
  { value: 'recipient_email', label: 'Recipient (TO) email' },
  { value: 'recipient_domain',label: 'Recipient (TO) domain' },
]
const OPERATORS = [
  { value: 'contains',    label: 'contains' },
  { value: 'equals',      label: '=' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with',   label: 'ends with' },
]

type PreviewCategory = { id: string; name: string; color: string; behavior: string; count: number }
type PreviewEmail    = { id: string; sender_name: string; sender_email: string; subject: string; date: string; snippet: string | null }

interface Props {
  onClose: () => void
  onSelectEmail: (emailId: string) => void
}

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#14b8a6','#4b5563']
const BEHAVIORS: { value: string; label: string }[] = [
  { value: 'always-summarize', label: 'Always summarize' },
  { value: 'digest-only',      label: 'Digest only' },
  { value: 'silent',           label: 'Silent' },
]

export function RulesPage({ onClose, onSelectEmail }: Props) {
  const [categories, setCategories]   = useState<Category[]>([])
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [showAddCat, setShowAddCat]   = useState(false)
  const [newCat, setNewCat]           = useState({ name: '', color: COLORS[0], behavior: 'digest-only' })
  const [preview, setPreview]         = useState<{ total: number; uncategorized_count: number; categories: PreviewCategory[] } | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>('none')  // 'none' = uncategorized, or category id
  const [emails, setEmails]           = useState<PreviewEmail[]>([])
  const [emailsTotal, setEmailsTotal] = useState(0)
  const [search, setSearch]           = useState('')
  const [previewing, setPreviewing]   = useState(false)
  const [applying, setApplying]       = useState(false)
  const [applied, setApplied]         = useState(false)
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([])
  const [suggesting, setSuggesting]   = useState(false)
  const [rightPanel, setRightPanel]   = useState<'emails' | 'suggestions'>('emails')
  const [addedRules, setAddedRules]   = useState<Set<number>>(new Set())

  useEffect(() => { loadCategories() }, [])

  const loadCategories = async () => setCategories(await api.getCategories())

  const createCategory = async () => {
    if (!newCat.name.trim()) return
    await api.createCategory(newCat)
    setShowAddCat(false)
    setNewCat({ name: '', color: COLORS[0], behavior: 'digest-only' })
    loadCategories()
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Emails will become uncategorized.')) return
    await api.deleteCategory(id)
    loadCategories()
  }

  const runPreview = async () => {
    setPreviewing(true)
    try {
      const p = await api.previewCategories()
      setPreview(p)
      await loadGroupEmails(selectedGroup, search, p)
    } finally {
      setPreviewing(false)
    }
  }

  const loadGroupEmails = useCallback(async (group: string, q: string, _p = preview) => {
    const result = await api.previewEmails(group, q)
    setEmails(result.emails)
    setEmailsTotal(result.total)
  }, [preview])

  const selectGroup = async (groupId: string) => {
    setSelectedGroup(groupId)
    setSearch('')
    await loadGroupEmails(groupId, '')
  }

  const doSearch = async (q: string) => {
    setSearch(q)
    await loadGroupEmails(selectedGroup, q)
  }

  const suggestRules = async () => {
    setSuggesting(true)
    setRightPanel('suggestions')
    try {
      const result = await api.suggestRules(50)
      setSuggestions(result.suggestions)
      setAddedRules(new Set())
    } finally {
      setSuggesting(false)
    }
  }

  const addSuggestion = async (s: RuleSuggestion, idx: number) => {
    // Find or create the category
    let cat = categories.find(c => c.name.toLowerCase() === s.category.toLowerCase())
    if (!cat) {
      cat = await api.createCategory({
        name: s.category,
        color: s.color || '#6366f1',
        behavior: (s.behavior || 'digest-only') as any,
      })
    }
    await api.addCategoryRule(cat.id, s.rule)
    setAddedRules(prev => new Set([...prev, idx]))
    await loadCategories()
  }

  const applyAll = async () => {
    setApplying(true)
    setApplied(false)
    try {
      await api.applyCategories()
      setApplied(true)
      setTimeout(() => setApplied(false), 3000)
      await runPreview()
    } finally {
      setApplying(false)
    }
  }

  const selectedGroupName = selectedGroup === 'none'
    ? `Uncategorized (${preview?.uncategorized_count ?? '?'})`
    : preview?.categories.find(c => c.id === selectedGroup)?.name ?? 'Loading...'

  const maxCount = preview
    ? Math.max(...preview.categories.map(c => c.count), preview.uncategorized_count, 1)
    : 1

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]">
      {/* Header */}
      <div className="shrink-0 h-11 bg-[var(--surface)] border-b border-[var(--line)] flex items-center px-4 gap-3">
        <span className="text-sm font-semibold text-[var(--text)]">Settings</span>
        <div className="flex-1" />
        <button onClick={suggestRules} disabled={suggesting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 rounded text-[var(--text)] disabled:opacity-50 transition-colors">
          {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          AI Suggest
        </button>
        <button onClick={runPreview} disabled={previewing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--line)] rounded text-[var(--text-2)] disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-3 h-3 ${previewing ? 'animate-spin' : ''}`} />
          Preview
        </button>
        <button onClick={applyAll} disabled={applying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-[var(--text)] disabled:opacity-50 transition-colors">
          {applying ? <RefreshCw className="w-3 h-3 animate-spin" /> : applied ? <Check className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
          {applied ? 'Applied!' : 'Apply to DB'}
        </button>
        <button onClick={onClose} className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] ml-1">✕</button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: categories + rules editor */}
        <div className="w-80 shrink-0 border-r border-[var(--line)] flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--line)]">
            <span className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider">Categories</span>
            <button onClick={() => setShowAddCat(v => !v)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent)] text-[var(--accent-ink)] rounded transition-colors">
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>

          {showAddCat && (
            <div className="shrink-0 p-3 border-b border-[var(--line)] space-y-2 bg-[var(--surface)]">
              <input value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createCategory()}
                placeholder="Category name"
                autoFocus
                className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-4)] outline-none focus:border-[var(--accent)]" />
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewCat(p => ({ ...p, color: c }))}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${newCat.color === c ? 'border-[var(--text)] scale-110' : 'border-transparent opacity-70'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select value={newCat.behavior} onChange={e => setNewCat(p => ({ ...p, behavior: e.target.value }))}
                  className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text-2)] outline-none">
                  {BEHAVIORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <button onClick={createCategory} className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--accent-ink)] rounded">Create</button>
                <button onClick={() => setShowAddCat(false)} className="px-1.5 py-1 text-[var(--text-3)]"><X className="w-3 h-3" /></button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-1">
              {categories.map(cat => (
                <CategoryRuleEditor key={cat.id} cat={cat}
                  expanded={expanded === cat.id}
                  onToggle={() => setExpanded(expanded === cat.id ? null : cat.id)}
                  onUpdate={loadCategories}
                  onDelete={() => deleteCategory(cat.id)}
                />
              ))}
              {categories.length === 0 && !showAddCat && (
                <p className="text-xs text-[var(--text-3)] text-center py-8">No categories yet. Click "New" to create one.</p>
              )}
            </div>
          </div>
          <div className="shrink-0 p-3 border-t border-[var(--line)]">
            <p className="text-xs text-[var(--text-4)]">
              Rules are checked top-to-bottom. First match wins.
            </p>
          </div>
        </div>

        {/* Right: preview + email browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Distribution */}
          <div className="shrink-0 border-b border-[var(--line)] p-4 space-y-2">
            <div className="text-xs text-[var(--text-3)] font-medium mb-3">
              {preview ? `Distribution across ${preview.total} emails` : 'Click Preview to see distribution'}
            </div>
            {preview && (
              <div className="space-y-1.5">
                {preview.categories.map(cat => (
                  <DistributionRow key={cat.id} label={cat.name} color={cat.color}
                    count={cat.count} total={preview.total} maxCount={maxCount}
                    selected={selectedGroup === cat.id}
                    onClick={() => selectGroup(cat.id)}
                  />
                ))}
                <DistributionRow
                  label="Uncategorized" color="#4b5563"
                  count={preview.uncategorized_count} total={preview.total} maxCount={maxCount}
                  selected={selectedGroup === 'none'}
                  onClick={() => selectGroup('none')}
                />
              </div>
            )}
          </div>

          {/* Toggle: emails | suggestions */}
          <div className="shrink-0 flex border-b border-[var(--line)]">
            <button onClick={() => setRightPanel('emails')}
              className={`flex-1 py-2 text-xs transition-colors ${rightPanel === 'emails' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              Email browser
            </button>
            <button onClick={() => setRightPanel('suggestions')}
              className={`flex-1 py-2 text-xs transition-colors ${rightPanel === 'suggestions' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              AI Suggestions {suggestions.length > 0 && <span className="ml-1 text-purple-500">{suggestions.length}</span>}
            </button>
          </div>

          {rightPanel === 'emails' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--line)]">
                <span className="text-xs font-medium text-[var(--text-2)]">{selectedGroupName}</span>
                <div className="flex-1" />
                <div className="flex items-center gap-1.5 bg-[var(--surface-2)] rounded px-2 py-1">
                  <Search className="w-3 h-3 text-[var(--text-3)]" />
                  <input value={search} onChange={e => doSearch(e.target.value)}
                    placeholder="Filter..."
                    className="bg-transparent text-xs text-[var(--text-2)] placeholder-[var(--text-4)] outline-none w-28" />
                </div>
                <span className="text-xs text-[var(--text-3)]">{emailsTotal} emails</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {emails.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-[var(--text-3)]">
                    {preview ? 'No emails' : 'Run Preview first'}
                  </div>
                )}
                {emails.map(email => (
                  <button key={email.id}
                    onClick={() => { onSelectEmail(email.id); onClose() }}
                    className="w-full flex items-start gap-3 px-4 py-2.5 border-b border-[var(--line)]/60 hover:bg-[var(--surface)] transition-colors text-left">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[var(--text-2)] truncate font-medium">{email.sender_name || email.sender_email}</span>
                        <span className="text-xs text-[var(--text-3)] shrink-0">
                          {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-3)] truncate">{email.subject}</div>
                      <div className="text-xs text-[var(--text-4)] mt-0.5">{email.sender_email}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {suggesting && (
                <div className="flex items-center justify-center h-32 gap-2 text-xs text-purple-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing emails...
                </div>
              )}
              {!suggesting && suggestions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-xs text-[var(--text-3)] gap-2">
                  <Wand2 className="w-5 h-5 opacity-30" />
                  Click "AI Suggest" to analyze uncategorized emails
                </div>
              )}
              {!suggesting && suggestions.map((s, idx) => (
                <SuggestionCard key={idx} suggestion={s} added={addedRules.has(idx)}
                  categories={categories}
                  onAdd={() => addSuggestion(s, idx)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DistributionRow({ label, color, count, total, maxCount, selected, onClick }: {
  label: string; color: string; count: number; total: number; maxCount: number
  selected: boolean; onClick: () => void
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-1.5 rounded transition-colors text-left ${selected ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface)]'}`}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-[var(--text-2)] w-28 truncate shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-[var(--text-2)] w-8 text-right shrink-0">{count}</span>
      <span className="text-xs text-[var(--text-3)] w-9 text-right shrink-0">{pct}%</span>
    </button>
  )
}

function CategoryRuleEditor({ cat, expanded, onToggle, onUpdate, onDelete }: {
  cat: Category; expanded: boolean; onToggle: () => void; onUpdate: () => void; onDelete: () => void
}) {
  const [addingRule, setAddingRule] = useState(false)
  const [newRule, setNewRule]       = useState({ field: 'sender_domain', operator: 'contains', value: '' })

  const addRule = async () => {
    if (!newRule.value.trim()) return
    await api.addCategoryRule(cat.id, newRule)
    setNewRule({ field: 'sender_domain', operator: 'contains', value: '' })
    setAddingRule(false)
    onUpdate()
  }

  return (
    <div className={`rounded border transition-colors ${expanded ? 'border-[var(--line)] bg-[var(--surface)]' : 'border-[var(--line)]'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="flex-1 text-xs text-[var(--text)] font-medium">{cat.name}</span>
          <span className="text-xs text-[var(--text-3)]">{cat.rules.length}</span>
          {expanded ? <ChevronDown className="w-3 h-3 text-[var(--text-3)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-3)]" />}
        </button>
        {expanded && (
          <button onClick={onDelete} className="text-[var(--text-4)] hover:text-[var(--danger)] transition-colors shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {cat.rules.length === 0 && (
            <p className="text-xs text-[var(--text-4)] italic px-1">No rules — no emails will auto-assign here.</p>
          )}
          {cat.rules.map(rule => (
            <RuleChip key={rule.id} rule={rule} onDelete={onUpdate} />
          ))}

          {addingRule ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-1">
                <select value={newRule.field} onChange={e => setNewRule(p => ({ ...p, field: e.target.value }))}
                  className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] rounded px-1.5 py-1 text-xs text-[var(--text-2)] outline-none">
                  {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={newRule.operator} onChange={e => setNewRule(p => ({ ...p, operator: e.target.value }))}
                  className="bg-[var(--surface-2)] border border-[var(--line)] rounded px-1.5 py-1 text-xs text-[var(--text-2)] outline-none">
                  {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-1">
                <input value={newRule.value} onChange={e => setNewRule(p => ({ ...p, value: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addRule()}
                  placeholder="e.g. apache.org"
                  autoFocus
                  className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text)] placeholder-[var(--text-4)] outline-none focus:border-[var(--accent)]" />
                <button onClick={addRule} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-[var(--text)]">Add</button>
                <button onClick={() => setAddingRule(false)} className="px-1.5 py-1 text-[var(--text-3)] hover:text-[var(--text-2)]"><X className="w-3 h-3" /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingRule(true)}
              className="flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] pt-1 transition-colors">
              <Plus className="w-3 h-3" /> Add rule
            </button>
          )}

          {/* Actions */}
          <ActionsEditor categoryId={cat.id} />
        </div>
      )}
    </div>
  )
}

function SuggestionCard({ suggestion: s, added, categories, onAdd }: {
  suggestion: RuleSuggestion
  added: boolean
  categories: Category[]
  onAdd: () => void
}) {
  const existingCat = categories.find(c => c.name.toLowerCase() === s.category.toLowerCase())
  const catColor    = existingCat?.color || s.color || '#6366f1'
  const field       = FIELDS.find(f => f.value === s.rule.field)?.label || s.rule.field
  const op          = OPERATORS.find(o => o.value === s.rule.operator)?.label || s.rule.operator

  return (
    <div className={`border-b border-[var(--line)]/60 px-4 py-3 transition-colors ${added ? 'opacity-50' : 'hover:bg-[var(--surface)]/50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Category + new badge */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
            <span className="text-xs font-medium text-[var(--text)]">{s.category}</span>
            {s.is_new_category && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400 border border-purple-800/50">new</span>
            )}
          </div>
          {/* Rule */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[var(--text-3)]">{field}</span>
            <span className="text-xs text-[var(--text-3)]">{op}</span>
            <span className="text-xs font-mono text-[var(--text-2)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">"{s.rule.value}"</span>
            <span className="text-xs text-[var(--text-3)]">→ {s.match_count} emails</span>
          </div>
          {/* Reason */}
          <p className="text-xs text-[var(--text-3)] italic">{s.reason}</p>
        </div>
        {/* Action button */}
        <button onClick={onAdd} disabled={added}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
            added
              ? 'text-green-400 bg-green-900/20 cursor-default'
              : 'text-[var(--text)] bg-purple-700 hover:bg-purple-600'
          }`}>
          {added ? <><CheckCircle2 className="w-3 h-3" /> Added</> : <><PlusCircle className="w-3 h-3" /> Add</>}
        </button>
      </div>
    </div>
  )
}

function RuleChip({ rule, onDelete }: { rule: CategoryRule; onDelete: () => void }) {
  const field = FIELDS.find(f => f.value === rule.field)?.label || rule.field
  const op    = OPERATORS.find(o => o.value === rule.operator)?.label || rule.operator
  return (
    <div className="flex items-center gap-1.5 bg-[var(--surface-2)] rounded px-2 py-1 group">
      <span className="text-xs text-[var(--text-3)]">{field}</span>
      <span className="text-xs text-[var(--text-3)]">{op}</span>
      <span className="text-xs text-[var(--text-2)] font-mono flex-1 truncate">"{rule.value}"</span>
      <button onClick={async () => { await api.deleteCategoryRule(rule.id); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-[var(--text-3)] hover:text-red-400 transition-all shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

const ACTION_TYPES: { value: ActionType; label: string; icon: typeof Terminal; description: string }[] = [
  { value: 'script',    label: 'Run Script',    icon: Terminal, description: 'Execute a shell command with email as input' },
  { value: 'ai_prompt', label: 'AI Analysis',   icon: Brain,   description: 'Run a custom AI prompt against the email' },
  { value: 'webhook',   label: 'Webhook',       icon: Globe,   description: 'POST email data to a URL' },
  { value: 'auto_tag',  label: 'Auto Tag',      icon: Tag,     description: 'Automatically tag emails' },
  { value: 'mark_read', label: 'Mark Read',     icon: MailOpen, description: 'Auto-mark as read' },
  { value: 'skip',      label: 'Skip',          icon: EyeOff,  description: 'Skip all processing' },
]

function ActionsEditor({ categoryId }: { categoryId: string }) {
  const [actions, setActions]   = useState<CategoryAction[]>([])
  const [adding, setAdding]     = useState(false)
  const [newType, setNewType]   = useState<ActionType>('script')
  const [newLabel, setNewLabel] = useState('')
  const [newConfig, setNewConfig] = useState('')

  useEffect(() => { loadActions() }, [categoryId])

  const loadActions = async () => setActions(await api.getCategoryActions(categoryId))

  const addAction = async () => {
    let config: Record<string, unknown> = {}
    try { config = newConfig ? JSON.parse(newConfig) : {} } catch {
      config = getDefaultConfig(newType, newConfig)
    }
    await api.addCategoryAction(categoryId, {
      type: newType,
      label: newLabel || undefined,
      config,
    })
    setNewConfig('')
    setNewLabel('')
    setAdding(false)
    loadActions()
  }

  const removeAction = async (id: string) => {
    await api.deleteCategoryAction(id)
    loadActions()
  }

  const toggleAction = async (action: CategoryAction) => {
    await api.updateCategoryAction(action.id, { is_active: !action.is_active })
    loadActions()
  }

  return (
    <div className="pt-2 mt-2 border-t border-[var(--line)]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-medium">Actions</span>
      </div>

      {actions.length === 0 && !adding && (
        <p className="text-[10px] text-[var(--text-4)] italic mb-1">No actions configured.</p>
      )}

      {actions.map(action => {
        const typeDef = ACTION_TYPES.find(t => t.value === action.type)
        const Icon = typeDef?.icon || Terminal
        return (
          <div key={action.id} className="flex items-center gap-1.5 bg-[var(--surface-2)] rounded px-2 py-1 mb-1 group">
            <Icon className="w-3 h-3 text-[var(--text-3)] shrink-0" />
            <span className={`text-xs flex-1 truncate ${action.is_active ? 'text-[var(--text-2)]' : 'text-[var(--text-3)] line-through'}`}>
              {action.label}
            </span>
            <button onClick={() => toggleAction(action)}
              className="opacity-0 group-hover:opacity-100 text-[var(--text-3)] hover:text-[var(--text-2)] transition-all shrink-0 text-[10px]">
              {action.is_active ? 'off' : 'on'}
            </button>
            <button onClick={() => removeAction(action.id)}
              className="opacity-0 group-hover:opacity-100 text-[var(--text-3)] hover:text-red-400 transition-all shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )
      })}

      {adding ? (
        <div className="space-y-1.5 pt-1">
          <select value={newType} onChange={e => { setNewType(e.target.value as ActionType); setNewConfig('') }}
            className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded px-1.5 py-1 text-xs text-[var(--text-2)] outline-none">
            {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — {t.description}</option>)}
          </select>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text)] placeholder-[var(--text-4)] outline-none" />
          {(newType === 'script' || newType === 'ai_prompt' || newType === 'webhook' || newType === 'auto_tag') && (
            <textarea value={newConfig} onChange={e => setNewConfig(e.target.value)}
              placeholder={getConfigPlaceholder(newType)}
              rows={3}
              className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text)] placeholder-[var(--text-4)] outline-none font-mono resize-none" />
          )}
          <div className="flex gap-1">
            <button onClick={addAction}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-[var(--text)]">
              <Play className="w-3 h-3" /> Add
            </button>
            <button onClick={() => setAdding(false)} className="px-1.5 py-1 text-[var(--text-3)] hover:text-[var(--text-2)]">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
          <Plus className="w-3 h-3" /> Add action
        </button>
      )}
    </div>
  )
}

function getConfigPlaceholder(type: ActionType): string {
  switch (type) {
    case 'script':    return '{"command": "/path/to/script.sh"}\nor just: /path/to/script.sh'
    case 'ai_prompt': return '{"prompt": "Analyze this job offer. Return JSON with: salary_range, location, tech_stack, pros, cons, fit_score (1-10)"}'
    case 'webhook':   return '{"url": "http://localhost:8080/hook"}'
    case 'auto_tag':  return '{"tags": ["github", "notification"]}'
    default:          return ''
  }
}

function getDefaultConfig(type: ActionType, raw: string): Record<string, unknown> {
  switch (type) {
    case 'script':    return { command: raw.trim() }
    case 'ai_prompt': return { prompt: raw.trim() }
    case 'webhook':   return { url: raw.trim() }
    case 'auto_tag':  return { tags: raw.split(',').map(s => s.trim()).filter(Boolean) }
    default:          return {}
  }
}
