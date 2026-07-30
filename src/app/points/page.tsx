import type { Metadata } from 'next'
import Link from 'next/link'

import { DevTopup } from '@/components/DevTopup'
import { ChargePlans } from '@/components/points/ChargePlans'
import { requireProfile } from '@/lib/auth'
import { fmtNum } from '@/lib/format'
import { POINT_PLANS } from '@/lib/points-plans'
import { isStripeConfigured } from '@/lib/stripe'

export const metadata: Metadata = { title: 'ポイントチャージ' }
export const dynamic = 'force-dynamic'

export default async function PointsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const profile = await requireProfile('/points')
  const canceled = (await searchParams).canceled === '1'

  const devEnabled =
    process.env.ENABLE_DEV_TOPUP === 'true' &&
    process.env.NODE_ENV !== 'production'

  // 決済キーが未設定の環境ではボタンを押せないようにしておく
  const stripeReady = isStripeConfigured()

  return (
    <div className="py-4">
      <h1 className="text-2xl font-black">ポイントチャージ</h1>

      <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 px-5 py-4">
        <p className="text-xs text-gold/80">現在の所持ポイント</p>
        <p className="mt-0.5 text-3xl font-black text-gold">
          {fmtNum(profile.points)}
          <span className="ml-1 text-base">pt</span>
        </p>
      </div>

      {canceled && (
        <p className="mt-4 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-ink-dim">
          決済をキャンセルしました。ポイントは消費されていません。
        </p>
      )}

      <ChargePlans plans={POINT_PLANS} enabled={stripeReady} />

      <p className="mt-5 rounded-xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-ink-dim">
        {stripeReady ? (
          <>
            決済は Stripe
            の安全な決済ページで行われます。カード情報が当サイトに保存されることはありません。
            <br />
          </>
        ) : (
          <>
            決済機能（Stripe 連携）は現在準備中です。
            <br />
          </>
        )}
        購入されたポイントの有効期限は最終利用日から180日間です。ポイントの現金への払い戻しは行っておりません。
      </p>

      {devEnabled && <DevTopup />}

      <Link
        href="/points/history"
        className="mt-6 block text-center text-sm text-ink-dim underline hover:text-ink"
      >
        ポイント履歴を見る
      </Link>
    </div>
  )
}
