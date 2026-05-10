import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { api, type Email } from '../../api/client'
import { Avatar } from '../shared/Avatar'
import { FilterPill } from '../shared/FilterPill'
import { Kbd } from '../shared/Kbd'

interface Props {
  onOpenEmail: (id: string) => void
}

function ListRow({
  email,
  selected,
  onClick,
}: {
  email: Email
  selected: boolean
  onClick: () => void
}) {
  const dateStr = new Date(email.date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        gap: 12,
        alignItems: 'center',
        textAlign: 'left',
        width: '100%',
        padding: 'var(--row-py) var(--row-px)',
        background: selected ? 'var(--surface-2)' : 'transparent',
        borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        borderBottom: '1px solid var(--line-soft)',
        transition: 'background .14s, border-color .14s',
      }}
    >
      <Avatar name={email.sender_name || email.sender_email} size={28} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: email.is_read ? 500 : 600,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '60%',
            }}
          >
            {email.sender_name || email.sender_email}
          </span>
          {!email.is_read && (
            <span className="dot" style={{ background: 'var(--accent)' }} />
          )}
          {email.category_name && (
            <span
              style={{
                fontSize: 11,
                color: email.category_color || 'var(--text-3)',
                fontWeight: 500,
              }}
            >
              {email.category_name}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: email.is_read ? 400 : 500,
            color: email.is_read ? 'var(--text-2)' : 'var(--text)',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {email.subject}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {email.snippet}
        </div>
      </div>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          alignSelf: 'start',
          paddingTop: 2,
        }}
      >
        {dateStr}
      </span>
    </button>
  )
}

export function InboxView({ onOpenEmail }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<string>('all')

  const { data: emailData, isLoading } = useQuery({
    queryKey: ['emails', null],
    queryFn: () => api.getEmails({ limit: 100 }),
    refetchInterval: 60_000,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  })

  const allEmails = emailData?.emails ?? []
  const filtered =
    catFilter === 'all'
      ? allEmails
      : allEmails.filter((e) => e.category_id === catFilter)

  // Count emails per category
  const catCounts = new Map<string, number>()
  for (const e of allEmails) {
    const key = e.category_id || 'none'
    catCounts.set(key, (catCounts.get(key) || 0) + 1)
  }

  const handleSelectEmail = (email: Email) => {
    setSelectedId(email.id)
    onOpenEmail(email.id)
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '400px 1fr',
        overflow: 'hidden',
      }}
    >
      {/* List pane */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--line)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 20px 14px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <h1
            style={{
              margin: '0 0 14px',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Inbox
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
            }}
          >
            <FilterPill
              active={catFilter === 'all'}
              onClick={() => setCatFilter('all')}
            >
              All{' '}
              <span style={{ opacity: 0.5, marginLeft: 4 }}>
                {allEmails.length}
              </span>
            </FilterPill>
            {categories?.map((c) => (
              <FilterPill
                key={c.id}
                active={catFilter === c.id}
                onClick={() => setCatFilter(c.id)}
                color={c.color}
              >
                {c.name}{' '}
                <span style={{ opacity: 0.5, marginLeft: 4 }}>
                  {catCounts.get(c.id) || 0}
                </span>
              </FilterPill>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 128,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--text-3)',
              }}
            >
              No emails in this view
            </div>
          ) : (
            filtered.map((e) => (
              <ListRow
                key={e.id}
                email={e}
                selected={selectedId === e.id}
                onClick={() => handleSelectEmail(e)}
              />
            ))
          )}
        </div>
      </div>

      {/* Empty state (reading pane is handled by routing) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          color: 'var(--text-3)',
          textAlign: 'center',
        }}
      >
        <Inbox
          size={28}
          style={{ color: 'var(--text-4)', marginBottom: 14 }}
        />
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-2)',
            marginBottom: 6,
          }}
        >
          Select a message
        </div>
        <div style={{ fontSize: 12, maxWidth: 260 }}>
          Or press <Kbd>J</Kbd> <Kbd>K</Kbd> to navigate.
        </div>
      </div>
    </div>
  )
}
