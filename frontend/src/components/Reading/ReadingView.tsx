import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Archive,
  Moon,
  Tag,
  Reply,
  Sparkles,
  Check,
  ChevronRight,
} from 'lucide-react'
import { api } from '../../api/client'
import type { EmailClassification, GtdColumn } from '../../api/client'
import { useSummary } from '../../hooks/useSummary'
import { Avatar } from '../shared/Avatar'
import { Kbd } from '../shared/Kbd'
import { CreateTaskFromEmail } from './CreateTaskFromEmail'

/** Parse the markdown summary into structured sections */
function parseSummary(raw: string): { tldr: string; sections: { title: string; items: string[] }[] } {
  if (!raw) return { tldr: '', sections: [] }

  // Split by ## headers
  const parts = raw.split(/^##\s*/m).filter(Boolean)
  let tldr = ''
  const sections: { title: string; items: string[] }[] = []

  for (const part of parts) {
    const lines = part.split('\n')
    const heading = lines[0].replace(/^#+\s*/, '').replace(/\s*##\s*$/, '').trim()
    const body = lines.slice(1).join('\n').trim()

    if (/tl;?dr/i.test(heading)) {
      tldr = body
    } else if (body && !/^none$/i.test(body)) {
      const items = body
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
      sections.push({ title: heading, items })
    }
  }

  // If no ## headers found, the whole thing is the TL;DR
  if (!tldr && sections.length === 0) {
    tldr = raw.replace(/^##.*$/gm, '').trim()
  }

  return { tldr, sections }
}

function ActionBtn({
  icon,
  label,
  shortcut,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
}) {
  return (
    <button
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--text-2)',
        transition: 'all .14s',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

type TaskStatus = 'idle' | 'loading' | 'proposing' | 'linked'

const listLabel = (l: string) =>
  ({ next: 'Next Action', waiting: 'Waiting For', someday: 'Someday', inbox: 'Inbox' }[l] || 'Inbox')

// Map classification list ids (from LLM) to ECC GtdColumn ids for task creation
const classListToCol = (list: string): GtdColumn =>
  (({ next: 'next', waiting: 'wait', someday: 'some', inbox: 'inbox', wait: 'wait', some: 'some' } as Record<string, GtdColumn>)[list] || 'inbox')

export function ReadingView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: email, isLoading } = useQuery({
    queryKey: ['email', id],
    queryFn: () => api.getEmail(id!),
    enabled: !!id,
  })

  const summary = useSummary(id ?? null)
  const parsed = parseSummary(summary.content)

  // Email-to-task state
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle')
  const [proposal, setProposal] = useState<EmailClassification | null>(null)
  const [linkedTitle, setLinkedTitle] = useState<string | null>(null)
  const [linkedList, setLinkedList] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Reset task state when email changes
  const emailTaskId = email?.gtd_task_id
  const effectiveStatus = emailTaskId ? 'linked' as const : taskStatus

  const startClassify = async () => {
    if (!id) return
    setTaskStatus('loading')
    try {
      const result = await api.classifyEmail(id)
      setProposal(result)
      setTaskStatus('proposing')
    } catch {
      setTaskStatus('idle')
    }
  }

  const confirmCreate = async () => {
    if (!id || !proposal || confirming) return
    setConfirming(true)
    try {
      await api.createTaskFromEmail(id, {
        title: proposal.title,
        col: classListToCol(proposal.list),
        due: proposal.dueHint || undefined,
      })
      setLinkedTitle(proposal.title)
      setLinkedList(proposal.list)
      setTaskStatus('linked')
    } catch (err) {
      console.warn('Failed to create task from email:', err)
    } finally {
      setConfirming(false)
    }
  }

  const cancelProposal = () => {
    setProposal(null)
    setTaskStatus('idle')
  }

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
    )
  }

  if (!email) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-3)',
        }}
      >
        Email not found
      </div>
    )
  }

  const date = new Date(email.date)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
      {/* Sticky action bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          padding: '12px 32px',
          borderBottom: '1px solid var(--line)',
          background: 'color-mix(in oklch, var(--bg) 88%, transparent)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-2)',
            borderRadius: 6,
          }}
        >
          <ArrowLeft size={13} /> Back to Today
        </button>
        <div style={{ flex: 1 }} />
        <ActionBtn
          icon={<Archive size={13} />}
          label="Archive"
          shortcut="E"
        />
        <ActionBtn
          icon={<Moon size={13} />}
          label="Snooze"
          shortcut="H"
        />
        <ActionBtn
          icon={<Tag size={13} />}
          label="Label"
          shortcut="L"
        />
        {effectiveStatus === 'linked' ? (
          <button
            onClick={() => navigate('/tasks')}
            title="Open linked task"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              background: 'var(--accent-ai-soft)',
              color: 'var(--accent-ai)',
              border: '1px solid color-mix(in oklch, var(--accent-ai) 24%, transparent)',
            }}
          >
            <Check size={12} /> Linked task <ChevronRight size={11} />
          </button>
        ) : (
          <button
            onClick={startClassify}
            disabled={effectiveStatus === 'loading'}
            title="Create a task from this email"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text-2)',
            }}
          >
            <Sparkles
              size={13}
              style={{
                color: 'var(--accent-ai)',
                animation: effectiveStatus === 'loading' ? 'spin 0.9s linear infinite' : 'none',
              }}
            />
            {effectiveStatus === 'loading' ? 'Analyzing...' : 'Create task'}
          </button>
        )}
        <div
          style={{
            width: 1,
            height: 18,
            background: 'var(--line)',
            margin: '0 6px',
          }}
        />
        <button
          style={{
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 500,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Reply size={12} />
          Reply{' '}
          <Kbd style={{ color: 'var(--accent-ink)', opacity: 0.6 }}>R</Kbd>
        </button>
      </div>

      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '44px 40px 80px',
        }}
      >
        {/* AI summary pinned at top */}
        <div
          style={{
            padding: 18,
            marginBottom: 32,
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Sparkles size={13} style={{ color: 'var(--accent)' }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-3)',
              }}
            >
              TL;DR
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text)',
            }}
          >
            {summary.isStreaming && !summary.content && (
              <span style={{ color: 'var(--text-3)' }}>Generating summary...</span>
            )}
            {parsed.tldr || (!summary.isStreaming && !summary.content && 'No summary available yet.')}
          </p>
          {parsed.sections.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {parsed.sections.map((s, i) => (
                <div key={i}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-3)',
                    marginBottom: 4,
                  }}>{s.title}</div>
                  <ul style={{
                    margin: 0,
                    padding: '0 0 0 16px',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text-2)',
                  }}>
                    {s.items.map((item, j) => (
                      <li key={j} style={{ marginBottom: 2 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {summary.error && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 12,
                color: 'var(--danger)',
              }}
            >
              {summary.error}
            </p>
          )}
        </div>

        {/* Task proposal panel (between summary and body) */}
        {effectiveStatus === 'proposing' && proposal && (
          <CreateTaskFromEmail
            proposal={proposal}
            onChange={(patch) => setProposal((p) => p ? { ...p, ...patch } : p)}
            onCancel={cancelProposal}
            onConfirm={confirmCreate}
            confirming={confirming}
          />
        )}

        {/* Linked confirmation banner */}
        {effectiveStatus === 'linked' && (linkedTitle || emailTaskId) && (
          <div
            style={{
              marginBottom: 20,
              padding: '12px 14px',
              background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Check size={14} style={{ color: 'var(--ok)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {linkedTitle ? (
                <>
                  Added to <b style={{ color: 'var(--text)' }}>{listLabel(linkedList || 'inbox')}</b>:
                  <span style={{ color: 'var(--text)', marginLeft: 6 }}>"{linkedTitle}"</span>
                </>
              ) : (
                'Linked to a task'
              )}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => navigate('/tasks')}
              style={{ fontSize: 11.5, color: 'var(--ok)' }}
            >
              Open →
            </button>
          </div>
        )}

        {/* Category chip */}
        {email.category_name && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <span
              className="chip"
              style={{
                color: email.category_color || 'var(--text-2)',
                background: email.category_color
                  ? `color-mix(in oklch, ${email.category_color} 14%, transparent)`
                  : 'var(--surface-2)',
                borderColor: 'transparent',
              }}
            >
              {email.category_name}
            </span>
          </div>
        )}

        {/* Subject */}
        <h1
          style={{
            margin: '0 0 18px',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
          }}
        >
          {email.subject}
        </h1>

        {/* Sender row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <Avatar
            name={email.sender_name || email.sender_email}
            size={36}
          />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>
              {email.sender_name || email.sender_email}{' '}
              <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
                &lt;{email.sender_email}&gt;
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {dateStr} · {timeStr}
            </div>
          </div>
        </div>

        {/* Article body */}
        <article
          style={{
            fontSize: 15,
            lineHeight: 1.75,
            color: 'var(--text-2)',
          }}
        >
          {email.body_html ? (
            <iframe
              srcDoc={email.body_html}
              style={{
                width: '100%',
                minHeight: 400,
                border: 'none',
                borderRadius: 8,
                background: 'white',
              }}
              sandbox="allow-same-origin"
              title="Email body"
            />
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {email.body_text || email.snippet || '(no content)'}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
