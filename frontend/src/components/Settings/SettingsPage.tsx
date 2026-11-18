import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, RefreshCw, X, Check } from 'lucide-react'
import { api, Category, CategoryRule } from '../../api/client'

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#14b8a6','#4b5563']
const FIELDS = [
  { value: 'sender_email',    label: 'Sender email' },
  { value: 'sender_domain',   label: 'Sender domain' },
  { value: 'sender_name',     label: 'Sender name' },
  { value: 'subject',         label: 'Subject' },
  { value: 'recipient_email', label: 'Recipient email (TO)' },
  { value: 'recipient_domain',label: 'Recipient domain (TO)' },
]
const OPERATORS = [
  { value: 'contains',    label: 'contains' },
  { value: 'equals',      label: 'equals' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with',   label: 'ends with' },
]
const BEHAVIORS: { value: string; label: string; desc: string }[] = [
  { value: 'always-summarize', label: 'Always summarize', desc: 'Expanded in digest, AI summary per group' },
  { value: 'digest-only',      label: 'Digest only',      desc: 'Shown in digest, collapsed by default' },
  { value: 'silent',           label: 'Silent',            desc: 'Synced but hidden from digest view' },
]

interface Props {
  onClose: () => void
}

export function SettingsPage({ onClose }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [applying, setApplying]     = useState(false)
  const [applyDone, setApplyDone]   = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [newCat, setNewCat]         = useState({ name: '', color: COLORS[0], behavior: 'digest-only' })

  useEffect(() => { load() }, [])

  const load = async () => setCategories(await api.getCategories())

  const createCategory = async () => {
    if (!newCat.name.trim()) return
    await api.createCategory(newCat)
    setShowAdd(false)
    setNewCat({ name: '', color: COLORS[0], behavior: 'digest-only' })
    load()
  }

  const applyAll = async () => {
    setApplying(true)
    setApplyDone(false)
    try {
      await api.applyCategories()
      setApplyDone(true)
      setTimeout(() => setApplyDone(false), 3000)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 h-11 bg-[var(--surface)] border-b border-[var(--line)] flex items-center px-4 gap-3">
        <span className="text-sm font-semibold text-[var(--text)]">Settings</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
          ✕ Back to inbox
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">

          {/* Section header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Categories</h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">Rule-based auto-sorting. First matching category wins.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={applyAll} disabled={applying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--line)] rounded text-[var(--text-2)] disabled:opacity-50 transition-colors">
                {applying ? <RefreshCw className="w-3 h-3 animate-spin" /> : applyDone ? <Check className="w-3 h-3 text-green-400" /> : <RefreshCw className="w-3 h-3" />}
                {applyDone ? 'Applied!' : 'Apply to all emails'}
              </button>
              <button onClick={() => setShowAdd(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-[var(--text)] transition-colors">
                <Plus className="w-3 h-3" />
                New category
              </button>
            </div>
          </div>

          {/* New category form */}
          {showAdd && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-[var(--text-2)]">New category</p>
              <input value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createCategory()}
                placeholder="Category name (e.g. Finance, Work, Newsletters)"
                autoFocus
                className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-4)] outline-none focus:border-[var(--accent)]" />
              <div className="flex gap-3 items-center">
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setNewCat(p => ({ ...p, color: c }))}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${newCat.color === c ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <select value={newCat.behavior} onChange={e => setNewCat(p => ({ ...p, behavior: e.target.value }))}
                  className="ml-auto bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text-2)] outline-none">
                  {BEHAVIORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-[var(--text-3)] hover:text-[var(--text-2)]">Cancel</button>
                <button onClick={createCategory} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-[var(--text)]">Create</button>
              </div>
            </div>
          )}

          {/* Category list */}
          <div className="space-y-1">
            {categories.length === 0 && !showAdd && (
              <div className="text-center py-12 text-xs text-[var(--text-3)]">
                No categories yet. Create one to start auto-sorting emails.
              </div>
            )}
            {categories.map(cat => (
              <CategoryCard key={cat.id} cat={cat}
                expanded={expanded === cat.id}
                onToggle={() => setExpanded(expanded === cat.id ? null : cat.id)}
                onUpdate={load}
                onDelete={async () => { await api.deleteCategory(cat.id); load() }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ cat, expanded, onToggle, onUpdate, onDelete }: {
  cat: Category
  expanded: boolean
  onToggle: () => void
  onUpdate: () => void
  onDelete: () => void
}) {
  const [editing, setEditing]   = useState(false)
  const [editName, setEditName] = useState(cat.name)
  const [editColor, setEditColor] = useState(cat.color)
  const [editBehavior, setEditBehavior] = useState(cat.behavior)
  const [newRule, setNewRule]   = useState({ field: 'sender_domain', operator: 'contains', value: '' })
  const [addingRule, setAddingRule] = useState(false)

  const saveEdit = async () => {
    await api.updateCategory(cat.id, { name: editName, color: editColor, behavior: editBehavior as any })
    setEditing(false)
    onUpdate()
  }

  const addRule = async () => {
    if (!newRule.value.trim()) return
    await api.addCategoryRule(cat.id, newRule)
    setNewRule({ field: 'sender_domain', operator: 'contains', value: '' })
    setAddingRule(false)
    onUpdate()
  }

  const behaviorColor = cat.behavior === 'always-summarize' ? 'text-green-400 bg-green-900/30' :
                        cat.behavior === 'silent'            ? 'text-[var(--text-3)] bg-[var(--surface-2)]' :
                                                               'text-blue-400 bg-blue-900/30'

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg overflow-hidden">
      {/* Row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left">
          <span className="text-sm text-[var(--text)]">{cat.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${behaviorColor}`}>{cat.behavior}</span>
          <span className="text-xs text-[var(--text-3)]">{cat.rules.length} rule{cat.rules.length !== 1 ? 's' : ''}</span>
        </button>
        <button onClick={() => { setEditing(v => !v); if (!expanded) onToggle() }}
          className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] px-1.5 py-0.5">
          Edit
        </button>
        <button onClick={onDelete} className="text-[var(--text-4)] hover:text-red-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onToggle} className="text-[var(--text-3)]">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-[var(--line)] px-3 py-3 space-y-3">
          {/* Edit form */}
          {editing && (
            <div className="bg-[var(--surface-2)] rounded p-3 space-y-2">
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--line)] rounded px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
              <div className="flex gap-3 items-center">
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setEditColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${editColor === c ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <select value={editBehavior} onChange={e => setEditBehavior(e.target.value as Category['behavior'])}
                  className="ml-auto bg-[var(--surface)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text-2)] outline-none">
                  {BEHAVIORS.map(b => <option key={b.value} value={b.value} title={b.desc}>{b.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-[var(--text-3)]">Cancel</button>
                <button onClick={saveEdit} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-[var(--text)]">Save</button>
              </div>
            </div>
          )}

          {/* Rules */}
          <div className="space-y-1">
            <div className="text-xs text-[var(--text-3)] font-medium mb-1.5">Matching rules</div>
            {cat.rules.length === 0 && (
              <p className="text-xs text-[var(--text-4)] italic">No rules — emails won't be auto-assigned to this category.</p>
            )}
            {cat.rules.map(rule => (
              <RuleRow key={rule.id} rule={rule} onDelete={onUpdate} />
            ))}
          </div>

          {/* Add rule */}
          {addingRule ? (
            <div className="flex gap-1.5 items-center flex-wrap">
              <select value={newRule.field} onChange={e => setNewRule(p => ({ ...p, field: e.target.value }))}
                className="bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text-2)] outline-none">
                {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select value={newRule.operator} onChange={e => setNewRule(p => ({ ...p, operator: e.target.value }))}
                className="bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text-2)] outline-none">
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input value={newRule.value} onChange={e => setNewRule(p => ({ ...p, value: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addRule()}
                placeholder="e.g. github.com"
                className="flex-1 min-w-24 bg-[var(--surface-2)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text)] placeholder-[var(--text-4)] outline-none focus:border-[var(--accent)]"
                autoFocus />
              <button onClick={addRule} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-[var(--text)]">Add</button>
              <button onClick={() => setAddingRule(false)} className="px-2 py-1 text-xs text-[var(--text-3)]"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => setAddingRule(true)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
              <Plus className="w-3 h-3" /> Add rule
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RuleRow({ rule, onDelete }: { rule: CategoryRule; onDelete: () => void }) {
  const field = FIELDS.find(f => f.value === rule.field)?.label || rule.field
  const op    = OPERATORS.find(o => o.value === rule.operator)?.label || rule.operator
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-[var(--surface-2)]/50 rounded text-xs">
      <span className="text-[var(--text-2)]">{field}</span>
      <span className="text-[var(--text-3)]">{op}</span>
      <span className="text-[var(--text-2)] font-mono flex-1">"{rule.value}"</span>
      <button onClick={async () => { await api.deleteCategoryRule(rule.id); onDelete() }}
        className="text-[var(--text-4)] hover:text-red-400 transition-colors shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
