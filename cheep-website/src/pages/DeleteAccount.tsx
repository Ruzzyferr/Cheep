import { useState } from 'react'
import { LegalLayout } from '../components/legal/LegalLayout'
import { RichText } from '../components/legal/RichText'
import { useT } from '../i18n'

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.cheep.live/api/v1'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function DeleteAccount() {
  const t = useT()
  const d = t.legal.del

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirm) return
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/users/account-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('success')
        setMessage(data.message ?? d.successFallback)
      } else {
        setStatus('error')
        setMessage(data.message ?? d.errorFallback)
      }
    } catch {
      setStatus('error')
      setMessage(d.networkError)
    }
  }

  return (
    <LegalLayout title={d.title} updated={d.updated}>
      <RichText blocks={d.intro} />

      {status === 'success' ? (
        <div className="mt-6 rounded-2xl border border-mint bg-mint-soft p-6">
          <p className="font-display text-lg font-bold text-forest-deep">{d.deletedTitle}</p>
          <p className="mt-1" style={{ color: 'var(--color-ink)' }}>
            {message}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 rounded-2xl border border-line bg-paper p-6 not-prose">
          <label htmlFor="del-email" className="mb-2 block text-sm font-semibold text-ink">
            {d.emailLabel}
          </label>
          <input
            id="del-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={d.emailPlaceholder}
            className="mb-4 w-full rounded-xl border border-line bg-cream px-4 py-3 text-ink outline-none focus:border-forest"
          />
          <label htmlFor="del-password" className="mb-2 block text-sm font-semibold text-ink">
            {d.passwordLabel}
          </label>
          <input
            id="del-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mb-4 w-full rounded-xl border border-line bg-cream px-4 py-3 text-ink outline-none focus:border-forest"
          />

          <label className="mb-5 flex items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#F0682B]"
            />
            <span>{d.confirmLabel}</span>
          </label>

          {status === 'error' && (
            <p className="mb-4 rounded-xl bg-[#FCEDED] px-4 py-3 text-sm text-[#C13438]" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={!confirm || status === 'loading'}
            className="w-full rounded-full bg-clementine-deep px-6 py-3.5 font-semibold text-white transition-all hover:bg-clementine-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? d.submitting : d.submit}
          </button>
        </form>
      )}

      <div style={{ marginTop: '2.5rem' }}>
        <RichText blocks={d.help} />
      </div>
    </LegalLayout>
  )
}
