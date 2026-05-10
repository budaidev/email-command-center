import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Flame,
  Inbox,
  Archive,
  CheckSquare,
  Activity,
  Brain,
  Settings,
  Sun,
  Moon,
} from 'lucide-react'
import { api } from '../../api/client'
import { Avatar } from '../shared/Avatar'

interface RailBtnProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
  badge?: number
}

function RailBtn({ icon, label, active, onClick, badge }: RailBtnProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--surface-3)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-3)',
        transition: 'all .14s',
      }}
    >
      {icon}
      {badge != null && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 14,
            height: 14,
            padding: '0 4px',
            borderRadius: 7,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <RailBtn
      icon={theme === 'dark' ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
      label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    />
  )
}

export function NavRail() {
  const location = useLocation()
  const navigate = useNavigate()

  const { data: emailData } = useQuery({
    queryKey: ['emails', null],
    queryFn: () => api.getEmails({ limit: 100, unread_only: true }),
    refetchInterval: 60_000,
  })

  const unreadCount = emailData?.total ?? 0
  const path = location.pathname

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        borderRight: '1px solid var(--line)',
        background: 'var(--surface)',
        width: 72,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 20,
        }}
      >
        C
      </div>

      {/* Top nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <RailBtn
          icon={<Flame size={17} strokeWidth={path === '/' ? 2 : 1.75} />}
          label="Today"
          active={path === '/'}
          onClick={() => navigate('/')}
        />
        <RailBtn
          icon={<Inbox size={17} strokeWidth={path === '/inbox' ? 2 : 1.75} />}
          label="Inbox"
          active={path === '/inbox'}
          onClick={() => navigate('/inbox')}
          badge={unreadCount}
        />
        <RailBtn
          icon={<Archive size={17} strokeWidth={path === '/archive' ? 2 : 1.75} />}
          label="Digest archive"
          active={path === '/archive'}
          onClick={() => navigate('/archive')}
        />
        <RailBtn
          icon={<Activity size={17} strokeWidth={path === '/pulse' ? 2 : 1.75} />}
          label="GTD Pulse"
          active={path === '/pulse'}
          onClick={() => navigate('/pulse')}
        />
        <RailBtn
          icon={<Brain size={17} strokeWidth={path === '/triage' ? 2 : 1.75} />}
          label="Triage Workbench"
          active={path === '/triage'}
          onClick={() => navigate('/triage')}
        />
        <RailBtn
          icon={<CheckSquare size={17} strokeWidth={path === '/tasks' ? 2 : 1.75} />}
          label="Tasks"
          active={path === '/tasks'}
          onClick={() => navigate('/tasks')}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Bottom nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <RailBtn
          icon={<Settings size={17} strokeWidth={path === '/settings' ? 2 : 1.75} />}
          label="Settings"
          active={path === '/settings'}
          onClick={() => navigate('/settings')}
        />
        <ThemeToggle />
        <div
          style={{
            width: 32,
            height: 1,
            background: 'var(--line)',
            margin: '8px 0',
          }}
        />
        <Avatar name="User" size={32} />
      </div>
    </aside>
  )
}
