import { useState } from 'react'
import { LegalLayout } from '../components/legal/LegalLayout'

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.cheep.live/api/v1'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function DeleteAccount() {
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
        setMessage(data.message ?? 'Hesabın ve tüm verilerin kalıcı olarak silindi.')
      } else {
        setStatus('error')
        setMessage(data.message ?? 'Silme başarısız. E-posta ve şifreni kontrol et.')
      }
    } catch {
      setStatus('error')
      setMessage('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar dene.')
    }
  }

  return (
    <LegalLayout title="Hesap Silme" updated="2 Temmuz 2026">
      <p>
        Cheep hesabını ve <strong>tüm verilerini</strong> (alışveriş listeleri, favori marketler,
        fiyat geri bildirimleri, asistan sohbetleri ve profil) kalıcı olarak silebilirsin. Bu işlem
        <strong> geri alınamaz</strong>.
      </p>

      <h2>Uygulama üzerinden</h2>
      <p>En hızlı yol: Cheep uygulamasında <strong>Profil → Hesabımı Sil</strong> adımını izle.</p>

      <h2>Uygulaman yoksa: web üzerinden sil</h2>
      <p>
        Uygulamayı kaldırdıysan, aşağıya hesabının e-posta ve şifresini girerek doğrula ve sil.
        Bilgiler yalnızca kimliğini doğrulamak için kullanılır.
      </p>

      {status === 'success' ? (
        <div className="mt-6 rounded-2xl border border-mint bg-mint-soft p-6">
          <p className="font-display text-lg font-bold text-forest-deep">✓ Silindi</p>
          <p className="mt-1" style={{ color: 'var(--color-ink)' }}>{message}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 rounded-2xl border border-line bg-paper p-6 not-prose">
          <label className="mb-2 block text-sm font-semibold text-ink">E-posta</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
            className="mb-4 w-full rounded-xl border border-line bg-cream px-4 py-3 text-ink outline-none focus:border-forest"
          />
          <label className="mb-2 block text-sm font-semibold text-ink">Şifre</label>
          <input
            type="password"
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
            <span>
              Hesabımın ve tüm verilerimin kalıcı olarak silineceğini, bu işlemin geri
              alınamayacağını anlıyorum.
            </span>
          </label>

          {status === 'error' && (
            <p className="mb-4 rounded-xl bg-[#FCEDED] px-4 py-3 text-sm text-[#C13438]">{message}</p>
          )}

          <button
            type="submit"
            disabled={!confirm || status === 'loading'}
            className="w-full rounded-full bg-clementine px-6 py-3.5 font-semibold text-white transition-all hover:bg-clementine-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}
          </button>
        </form>
      )}

      <h2 style={{ marginTop: '2.5rem' }}>Yardım</h2>
      <p>
        Sorun yaşarsan <a href="mailto:destek@cheep.live">destek@cheep.live</a> adresine yaz;
        hesabını senin için silelim.
      </p>
    </LegalLayout>
  )
}
