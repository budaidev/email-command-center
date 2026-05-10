import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, RefreshCw } from 'lucide-react'
import { api, Email } from '../../api/client'
import { EmailItem } from './EmailItem'

interface Props {
  selectedAccountId: string | null
  selectedEmailId: string | null
  onSelectEmail: (email: Email) => void
}

function groupByDate(emails: Email[]): Record<string, Email[]> {
  const groups: Record<string, Email[]> = {}
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const email of emails) {
    const d = new Date(email.date)
    let label: string
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

    if (!groups[label]) groups[label] = []
    groups[label].push(email)
  }
  return groups
}

export function EmailList({ selectedAccountId, selectedEmailId, onSelectEmail }: Props) {
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['emails', selectedAccountId],
    queryFn: () => api.getEmails({ account_id: selectedAccountId || undefined, limit: 100 }),
    refetchInterval: 60_000,
  })

  const { data: searchResults } = useQuery({
    queryKey: ['emails-search', search],
    queryFn: () => api.searchEmails(search),
    enabled: search.length > 2,
  })

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.triggerSync(selectedAccountId || undefined)
      setTimeout(() => refetch(), 2000)
    } finally {
      setSyncing(false)
    }
  }

  const emails = search.length > 2
    ? (searchResults?.emails ?? [])
    : (data?.emails ?? [])

  const groups = groupByDate(emails)

  return (
    <div className="flex flex-col h-full">
      {/* Search + sync bar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-800">
        <div className="flex-1 flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
          <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emails..."
            className="bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none w-full"
          />
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Sync now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : emails.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-600">
            {search ? 'No results' : 'No emails — add an account to get started'}
          </div>
        ) : (
          Object.entries(groups).map(([label, groupEmails]) => (
            <div key={label}>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-900 sticky top-0 border-b border-gray-800">
                {label} <span className="text-gray-700">({groupEmails.length})</span>
              </div>
              {groupEmails.map(email => (
                <EmailItem
                  key={email.id}
                  email={email}
                  selected={selectedEmailId === email.id}
                  onClick={() => onSelectEmail(email)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {data && (
        <div className="px-3 py-1.5 border-t border-gray-800 text-xs text-gray-600">
          {data.total} emails
        </div>
      )}
    </div>
  )
}
