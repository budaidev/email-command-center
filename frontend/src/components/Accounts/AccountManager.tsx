import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { api, Account } from '../../api/client'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

interface AddFormProps {
  onClose: () => void
}

function AddAccountForm({ onClose }: AddFormProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ email: '', label: '', imap_user: '', imap_pass: '', color: COLORS[0] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.addAccount({
        email: form.email,
        label: form.label || form.email,
        imap_user: form.imap_user || form.email,
        imap_pass: form.imap_pass,
        color: form.color,
      })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['emails'] })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Add Email Account</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Email address</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Display name (optional)</label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Work, Personal..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">IMAP username</label>
            <input
              type="text"
              value={form.imap_user}
              onChange={e => setForm(f => ({ ...f, imap_user: e.target.value }))}
              placeholder="Same as email, or custom"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Password</label>
            <input
              required
              type="password"
              value={form.imap_pass}
              onChange={e => setForm(f => ({ ...f, imap_pass: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-5 h-5 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-white' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm rounded transition-colors"
          >
            {loading ? 'Connecting...' : 'Add Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

interface Props {
  selectedAccountId: string | null
  onSelectAccount: (id: string | null) => void
}

export function AccountManager({ selectedAccountId, onSelectAccount }: Props) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  })

  const handleDelete = async (account: Account, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Remove ${account.label}?`)) return
    await api.deleteAccount(account.id)
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['emails'] })
    if (selectedAccountId === account.id) onSelectAccount(null)
  }

  return (
    <>
      <div className="p-2 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Accounts</span>
          <button
            onClick={() => setShowAdd(true)}
            className="text-gray-500 hover:text-blue-400 transition-colors"
            title="Add account"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => onSelectAccount(null)}
          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
            selectedAccountId === null
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          All accounts
        </button>

        {accounts.map(account => (
          <div
            key={account.id}
            className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
              selectedAccountId === account.id
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            onClick={() => onSelectAccount(account.id)}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: account.color }}
            />
            <span className="flex-1 truncate">{account.label}</span>
            <button
              onClick={e => handleDelete(account, e)}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {accounts.length === 0 && (
          <p className="text-xs text-gray-700 px-2 py-1">No accounts yet</p>
        )}
      </div>

      {showAdd && <AddAccountForm onClose={() => setShowAdd(false)} />}
    </>
  )
}
