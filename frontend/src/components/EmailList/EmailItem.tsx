import { Email, Tag } from '../../api/client'

interface Props {
  email: Email
  selected: boolean
  onClick: () => void
}

export function EmailItem({ email, selected, onClick }: Props) {
  const date = new Date(email.date)
  const dateStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const emailTags: Tag[] = email.tags ? JSON.parse(email.tags) : []

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-gray-800 transition-colors hover:bg-gray-800 ${
        selected ? 'bg-gray-800 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className={`text-xs truncate flex-1 ${email.is_read ? 'text-gray-400' : 'text-white font-medium'}`}>
          {email.sender_name || email.sender_email}
        </span>
        <span className="text-xs text-gray-500 shrink-0">{dateStr}</span>
      </div>
      <div className={`text-xs truncate mb-0.5 ${email.is_read ? 'text-gray-500' : 'text-gray-300'}`}>
        {email.subject}
      </div>
      {email.snippet && (
        <div className="text-xs text-gray-600 truncate">{email.snippet}</div>
      )}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: email.account_color }}
        />
        <span className="text-xs text-gray-600 truncate">{email.account_label}</span>
        {email.category_name && (
          <span className="px-1.5 py-px rounded text-white leading-tight shrink-0"
            style={{ backgroundColor: email.category_color || '#4b5563', fontSize: '10px' }}>
            {email.category_name}
          </span>
        )}
        {emailTags.map(t => (
          <span key={t.id} className="px-1.5 py-px rounded-full text-xs font-medium text-white leading-tight"
            style={{ backgroundColor: t.color, fontSize: '10px' }}>
            {t.name}
          </span>
        ))}
        {!email.is_read && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        )}
      </div>
    </button>
  )
}
