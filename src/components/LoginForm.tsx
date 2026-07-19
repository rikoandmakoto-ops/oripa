'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setMessage('')

    const supabase = createClient()
    const callback = new URL('/auth/callback', window.location.origin)
    if (next) callback.searchParams.set('next', next)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback.toString() },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <div className="mt-8 rounded-2xl border border-accent/40 bg-accent/10 p-6 text-center">
        <p className="text-lg font-bold text-accent">メールを送信しました</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          <span className="text-ink">{email}</span> 宛のログインリンクを
          <br />
          開いてください。
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-4 text-xs text-ink-dim underline hover:text-ink"
        >
          別のアドレスで送り直す
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-3">
      <label htmlFor="email" className="sr-only">
        メールアドレス
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-base outline-none transition placeholder:text-ink-dim/60 focus:border-brand"
      />

      {status === 'error' && (
        <p className="text-sm text-rarity-s">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-xl bg-linear-to-r from-brand to-brand-2 py-3.5 text-base font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {status === 'sending' ? '送信中…' : 'ログインリンクを受け取る'}
      </button>
    </form>
  )
}
