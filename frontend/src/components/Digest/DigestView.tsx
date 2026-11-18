import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Mail, Loader2 } from 'lucide-react'
import { api, DigestGroup } from '../../api/client'

type Period = '1d' | '7d' | '30d'

interface Props {
  onSelectEmail: (emailId: string) => void
}

const PERIOD_LABELS: Record<Period, string> = { '1d': 'Today', '7d': '7 days', '30d': '30 days' }

export function DigestView({ onSelectEmail }: Props) {
  const [period, setPeriod] = useState<Period>('1d')
  const [expanded, setExpanded] = useState<Set<string | null>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['digest', period],
    queryFn: () => api.getDigest(period),
    refetchInterval: 60_000,
  })

  const toggle = (id: string | null) => {
    setExpanded(prev => {
      const next = new Set(prev)
      const key = id ?? '__uncategorized__'
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isExpanded = (id: string | null) => expanded.has(id ?? '__uncategorized__')

  return (
    <div className="flex flex-col h-full">
      {/* Period selector */}
      <div className="shrink-0 flex items-center gap-1 p-3 border-b border-gray-800">
        <span className="text-xs text-gray-600 mr-1">Digest:</span>
        {(['1d', '7d', '30d'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              period === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-xs text-gray-600">{data.total} emails</span>
        )}
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-xs text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading digest...
          </div>
        ) : !data || data.groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-xs text-gray-600 gap-1">
            <Mail className="w-6 h-6 mb-1 opacity-30" />
            No emails in this period
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {data.groups.map(group => (
              <DigestGroupRow key={group.id ?? '__uncategorized__'}
                group={group}
                expanded={isExpanded(group.id)}
                onToggle={() => toggle(group.id)}
                onSelectEmail={onSelectEmail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DigestGroupRow({ group, expanded, onToggle, onSelectEmail }: {
  group: DigestGroup
  expanded: boolean
  onToggle: () => void
  onSelectEmail: (id: string) => void
}) {
  const autoExpand = group.behavior === 'always-summarize'

  return (
    <div>
      {/* Group header */}
      <button onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-900 transition-colors text-left">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
        <span className="flex-1 text-sm font-medium text-gray-200">{group.name}</span>
        <span className="text-xs text-gray-500">{group.count} email{group.count !== 1 ? 's' : ''}</span>
        {group.unread > 0 && (
          <span className="text-xs font-medium text-blue-400">{group.unread} unread</span>
        )}
        {(expanded || autoExpand) ? <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
      </button>

      {/* Email list */}
      {(expanded || autoExpand) && (
        <div className="bg-gray-900/50">
          {group.emails.map(email => (
            <button key={email.id} onClick={() => onSelectEmail(email.id)}
              className="w-full flex items-start gap-3 px-6 py-2 hover:bg-gray-800 transition-colors text-left border-t border-gray-800/50">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${email.is_read ? 'bg-gray-700' : 'bg-blue-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs truncate ${email.is_read ? 'text-gray-500' : 'text-gray-200 font-medium'}`}>
                    {email.sender_name || email.sender_name}
                  </span>
                  <span className="text-xs text-gray-600 shrink-0">
                    {new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`text-xs truncate ${email.is_read ? 'text-gray-600' : 'text-gray-400'}`}>
                  {email.subject}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
