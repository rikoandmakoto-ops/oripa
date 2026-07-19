'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * 開発用チャージボタン。
 * サーバー側でも ENABLE_DEV_TOPUP と NODE_ENV を検査しているので、
 * このコンポーネントが誤って本番に出ても API は 404 を返す。
 */
export function DevTopup() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function topup(amount: number) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/dev/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) {
        setError('チャージに失敗しました。')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-5">
      <p className="text-sm font-bold text-accent">開発モード</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-dim">
        決済を挟まずにポイントを付与します。
        <code className="mx-1 rounded bg-bg px-1.5 py-0.5">ENABLE_DEV_TOPUP</code>
        が有効なときだけ表示されます。
      </p>

      {error && <p className="mt-3 text-sm text-rarity-s">{error}</p>}

      <div className="mt-4 flex gap-2">
        {[1000, 10000, 50000].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onClick={() => topup(n)}
            className="flex-1 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/20 disabled:opacity-50"
          >
            +{n.toLocaleString('ja-JP')}pt
          </button>
        ))}
      </div>
    </div>
  )
}
