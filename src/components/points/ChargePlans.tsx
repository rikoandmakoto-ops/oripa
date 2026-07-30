'use client'

import { useState } from 'react'

import type { PointPlan } from '@/lib/points-plans'

/**
 * ポイントチャージのプラン一覧。
 *
 * 送るのはプラン ID だけ。金額とポイント数はサーバ側で引き直されるので、
 * ここの表示を書き換えても請求額は変わらない。
 */
export function ChargePlans({
  plans,
  enabled,
}: {
  plans: readonly PointPlan[]
  enabled: boolean
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout(planId: string) {
    setPendingId(planId)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      })

      const data = (await res.json().catch(() => null)) as {
        url?: string
        error?: string
      } | null

      if (!res.ok || !data?.url) {
        setError(data?.error ?? '決済ページを開けませんでした。')
        setPendingId(null)
        return
      }

      // Stripe の決済ページへ。戻り先は /points/complete。
      // (外部ドメインなので router.push ではなくフルナビゲーション)
      window.location.assign(data.url)
    } catch {
      setError('通信に失敗しました。電波の良い場所でお試しください。')
      setPendingId(null)
    }
  }

  const busy = pendingId !== null

  return (
    <div className="mt-6 space-y-2">
      {error && (
        <p className="rounded-xl border border-rarity-s/40 bg-rarity-s/10 px-4 py-3 text-sm text-rarity-s">
          {error}
        </p>
      )}

      {plans.map((plan) => (
        <div
          key={plan.id}
          className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-4"
        >
          <div>
            <p className="text-lg font-black">
              {(plan.points + plan.bonus).toLocaleString('ja-JP')}
              <span className="ml-1 text-sm font-medium text-ink-dim">pt</span>
            </p>
            {plan.bonus > 0 && (
              <p className="text-[11px] font-bold text-brand">
                ボーナス +{plan.bonus.toLocaleString('ja-JP')}pt
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => startCheckout(plan.id)}
            className={
              enabled
                ? 'rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50'
                : 'cursor-not-allowed rounded-xl border border-line px-5 py-2.5 text-sm font-bold text-ink-dim'
            }
          >
            {pendingId === plan.id
              ? '準備中…'
              : `¥${plan.yen.toLocaleString('ja-JP')}`}
          </button>
        </div>
      ))}
    </div>
  )
}
