import type { Metadata } from 'next'
import Link from 'next/link'

import { DevTopup } from '@/components/DevTopup'
import { requireProfile } from '@/lib/auth'
import { fmtNum } from '@/lib/format'

export const metadata: Metadata = { title: 'ポイントチャージ' }
export const dynamic = 'force-dynamic'

/** 販売するポイントの組み合わせ。1pt = 1円 想定。 */
const PLANS = [
  { points: 1000, yen: 1000, bonus: 0 },
  { points: 3000, yen: 3000, bonus: 100 },
  { points: 5000, yen: 5000, bonus: 300 },
  { points: 10000, yen: 10000, bonus: 1000 },
  { points: 30000, yen: 30000, bonus: 4000 },
]

export default async function PointsPage() {
  const profile = await requireProfile('/points')

  const devEnabled =
    process.env.ENABLE_DEV_TOPUP === 'true' &&
    process.env.NODE_ENV !== 'production'

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

      <div className="mt-6 space-y-2">
        {PLANS.map((p) => (
          <div
            key={p.points}
            className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-4"
          >
            <div>
              <p className="text-lg font-black">
                {fmtNum(p.points + p.bonus)}
                <span className="ml-1 text-sm font-medium text-ink-dim">pt</span>
              </p>
              {p.bonus > 0 && (
                <p className="text-[11px] font-bold text-brand">
                  ボーナス +{fmtNum(p.bonus)}pt
                </p>
              )}
            </div>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl border border-line px-5 py-2.5 text-sm font-bold text-ink-dim"
            >
              ¥{fmtNum(p.yen)}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-5 rounded-xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-ink-dim">
        決済機能（Stripe 連携）は準備中です。
        <br />
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
