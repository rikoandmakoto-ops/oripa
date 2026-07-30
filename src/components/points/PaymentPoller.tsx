'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * 入金反映待ちの間だけページを再取得する。
 *
 * ポイントが増えるのは Stripe の Webhook が届いたときで、
 * 決済ページから戻ってきた瞬間には、まだ反映されていないことがある
 * (数秒程度)。その間だけ数秒おきにサーバへ聞き直す。
 */
export function PaymentPoller({
  intervalMs = 2500,
  maxAttempts = 12,
}: {
  intervalMs?: number
  maxAttempts?: number
}) {
  const router = useRouter()
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (attempts >= maxAttempts) return

    const timer = setTimeout(() => {
      setAttempts((n) => n + 1)
      router.refresh()
    }, intervalMs)

    return () => clearTimeout(timer)
  }, [attempts, intervalMs, maxAttempts, router])

  if (attempts >= maxAttempts) {
    return (
      <p className="mt-4 text-xs leading-relaxed text-ink-dim">
        反映に時間がかかっています。決済が完了していれば必ず加算されますので、
        しばらく経ってからポイント履歴をご確認ください。
      </p>
    )
  }

  return (
    <p className="mt-4 text-xs text-ink-dim">
      反映を確認しています…（{attempts + 1}/{maxAttempts}）
    </p>
  )
}
