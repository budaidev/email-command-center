import { useState, useEffect, useRef } from 'react'
import { Sparkles, Tag, RefreshCw, Loader2, CalendarClock, User, DollarSign, Link2, CheckSquare, X, Plus, Wand2, Zap, Play, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Email, Tag as TagType, ActionLogEntry, api } from '../../api/client'
import { useSummary, EmailRef } from '../../hooks/useSummary'

interface Props {
  email: Email | null
}

type Tab = 'summary' | 'actions' | 'tags'

export function RightPanel({ email }: Props) {
  const [tab, setTab] = useState<Tab>('summary')

  const tabs = [
    { id: 'summary' as Tab, label: 'Summary', icon: Sparkles },
    { id: 'actions' as Tab, label: 'Actions', icon: Zap },
    { id: 'tags' as Tab, label: 'Tags', icon: Tag },
  ]

  if (!email) {
    return (
      <div className="flex flex-col h-full border-l border-gray-800">
        <div className="flex border-b border-gray-800">
          {tabs.map(t => (
            <button key={t.id} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-700 border-b-2 border-transparent">
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center flex-1 text-xs text-gray-700">
          Select an email
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full border-l border-gray-800">
      <div className="flex border-b border-gray-800 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'summary' && <SummaryTab email={email} />}
        {tab === 'actions' && <ActionsTab email={email} />}
        {tab === 'tags' && <TagsTab email={email} />}
      </div>
    </div>
  )
}

const REF_ICONS: Record<string, React.ElementType> = {
  action: CheckSquare,
  date: CalendarClock,
  contact: User,
  amount: DollarSign,
  link: Link2,
}

const REF_COLORS: Record<string, string> = {
  action: 'text-orange-400',
  date: 'text-blue-400',
  contact: 'text-green-400',
  amount: 'text-yellow-400',
  link: 'text-purple-400',
}

function RefItem({ r }: { r: EmailRef }) {
  const Icon = REF_ICONS[r.type] || CheckSquare
  const color = REF_COLORS[r.type] || 'text-gray-400'
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <span className="text-xs text-gray-300 break-words">{r.content}</span>
        {r.due_date && (
          <span className="ml-1.5 text-xs text-gray-600">({r.due_date})</span>
        )}
      </div>
    </div>
  )
}

function SummaryTab({ email }: { email: Email }) {
  const { content, isStreaming, error, refs, refresh } = useSummary(email.id, true)

  return (
    <div className="p-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">AI Summary</div>
        <button
          onClick={refresh}
          disabled={isStreaming}
          title="Regenerate summary"
          className="p-1 text-gray-600 hover:text-gray-400 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isStreaming ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {isStreaming && !content && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating summary...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded p-2">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={refresh} className="text-xs text-red-500 underline mt-1">Retry</button>
        </div>
      )}

      {/* Summary content */}
      {content && (
        <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-3 bg-blue-400 ml-0.5 animate-pulse" />}
        </div>
      )}

      {/* Extracted references */}
      {refs.length > 0 && (
        <div className="border-t border-gray-800 pt-3 space-y-0.5">
          <div className="text-xs text-gray-600 mb-1.5">Extracted</div>
          {refs.map(r => <RefItem key={r.id} r={r} />)}
        </div>
      )}

      {/* Quick info always shown */}
      <div className="border-t border-gray-800 pt-2">
        <div className="bg-gray-800/40 rounded p-2 text-xs text-gray-500 space-y-0.5">
          <div>From: {email.sender_email}</div>
          <div>Date: {new Date(email.date).toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

function ActionsTab({ email }: { email: Email }) {
  const [log, setLog] = useState<ActionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setExpanded(null)
    api.getActionLog(email.id).then(setLog).finally(() => setLoading(false))
  }, [email.id])

  const rerun = async () => {
    setRunning(true)
    try {
      await api.rerunActions(email.id)
      const updated = await api.getActionLog(email.id)
      setLog(updated)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">Action Log</div>
        <button onClick={rerun} disabled={running}
          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Re-run
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading...
        </div>
      ) : log.length === 0 ? (
        <div className="text-xs text-gray-700">
          {email.category_id
            ? 'No actions have run for this email yet.'
            : 'Email is uncategorized — no actions to run.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {log.map(entry => (
            <div key={entry.id}>
              <button
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                className="w-full flex items-start gap-2 bg-gray-900/50 rounded px-2.5 py-2 border border-gray-800/50 hover:border-gray-700 transition-colors text-left"
              >
                {entry.status === 'success'
                  ? <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                  : <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-300">{entry.action_label}</span>
                    <span className="text-[10px] text-gray-600">{entry.action_type}</span>
                  </div>
                  <span className="text-[10px] text-gray-600">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              </button>
              {expanded === entry.id && entry.output && (
                <div className="mt-0.5 bg-gray-950 border border-gray-800 rounded p-2 max-h-64 overflow-y-auto">
                  <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {tryFormatOutput(entry.output)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {email.category_name && (
        <div className="border-t border-gray-800 pt-2">
          <div className="text-[10px] text-gray-600">
            Category: <span className="text-gray-500">{email.category_name}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function tryFormatOutput(output: string): string {
  try {
    const parsed = JSON.parse(output)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return output
  }
}

function TagsTab({ email }: { email: Email }) {
  const [tags, setTags] = useState<TagType[]>([])
  const [allTags, setAllTags] = useState<TagType[]>([])
  const [suggestions, setSuggestions] = useState<TagType[]>([])
  const [input, setInput] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    setSuggestions([])
    Promise.all([api.getEmailTags(email.id), api.getTags()]).then(([emailTags, all]) => {
      setTags(emailTags)
      setAllTags(all)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [email.id])

  const addTag = async (tag: TagType) => {
    let t = tag
    if (!t.id) {
      t = await api.createTag(t.name, t.color)
      setAllTags(prev => [...prev.filter(x => x.name !== t.name), t])
    }
    if (tags.find(x => x.id === t.id)) return
    await api.addEmailTag(email.id, t.id!)
    setTags(prev => [...prev, t])
    setSuggestions(prev => prev.filter(s => s.name !== t.name))
    setInput('')
  }

  const removeTag = async (tagId: string) => {
    await api.removeEmailTag(email.id, tagId)
    setTags(prev => prev.filter(t => t.id !== tagId))
  }

  const suggest = async () => {
    setSuggesting(true)
    try {
      const s = await api.suggestTags(email.id)
      setSuggestions(s.filter(s => !tags.find(t => t.name === s.name)))
    } finally {
      setSuggesting(false)
    }
  }

  const filtered = input.trim()
    ? allTags.filter(t =>
        t.name.toLowerCase().includes(input.toLowerCase()) &&
        !tags.find(x => x.id === t.id)
      )
    : []

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      const match = allTags.find(t => t.name.toLowerCase() === input.toLowerCase())
      if (match) addTag(match)
      else addTag({ id: null, name: input.trim(), color: '' })
    }
  }

  return (
    <div className="p-3 space-y-3">
      {/* Current tags */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 min-h-[24px]">
          {tags.length === 0 && <span className="text-xs text-gray-700">No tags yet</span>}
          {tags.map(t => (
            <span key={t.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: t.color }}>
              {t.name}
              <button onClick={() => removeTag(t.id!)} className="opacity-70 hover:opacity-100">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        {filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10 max-h-32 overflow-y-auto">
            {filtered.map(t => (
              <button key={t.id} onClick={() => { addTag(t); setInput('') }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-700 text-left">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI suggest */}
      <button onClick={suggest} disabled={suggesting}
        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40 transition-colors">
        {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
        Suggest with AI
      </button>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-600">Suggestions</div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => addTag(s)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white opacity-80 hover:opacity-100 transition-opacity"
                style={{ backgroundColor: s.color }}>
                <Plus className="w-2.5 h-2.5" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
