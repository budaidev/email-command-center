import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Archive, ExternalLink } from 'lucide-react'
import { api, Email } from '../../api/client'

interface Props {
  emailId: string | null
  onDeleted: () => void
}

export function EmailDetail({ emailId, onDeleted }: Props) {
  const queryClient = useQueryClient()

  const { data: email, isLoading } = useQuery({
    queryKey: ['email', emailId],
    queryFn: () => api.getEmail(emailId!),
    enabled: !!emailId,
  })

  const handleDelete = async () => {
    if (!email || !confirm('Delete this email?')) return
    await api.deleteEmail(email.id)
    queryClient.invalidateQueries({ queryKey: ['emails'] })
    onDeleted()
  }

  if (!emailId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        Select an email to read
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!email) return null

  const recipients = JSON.parse(email.recipients || '[]') as { name: string; email: string }[]
  const date = new Date(email.date).toLocaleString()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-base font-semibold text-white mb-2 leading-snug">{email.subject}</h2>
        <div className="space-y-1 text-xs text-gray-400">
          <div><span className="text-gray-600">From:</span> {email.sender_name} &lt;{email.sender_email}&gt;</div>
          {recipients.length > 0 && (
            <div><span className="text-gray-600">To:</span> {recipients.map(r => r.email).join(', ')}</div>
          )}
          <div><span className="text-gray-600">Date:</span> {date}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors border border-red-900/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <button
            disabled
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 rounded border border-gray-800 cursor-not-allowed"
            title="Coming in Phase 5"
          >
            <Archive className="w-3.5 h-3.5" />
            Archive to Paperless
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {email.body_html ? (
          <iframe
            srcDoc={email.body_html}
            className="w-full h-full min-h-96 border-0 bg-white rounded"
            sandbox="allow-same-origin"
            title="Email body"
          />
        ) : (
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
            {email.body_text || email.snippet || '(no content)'}
          </pre>
        )}
      </div>
    </div>
  )
}
