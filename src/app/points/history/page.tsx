import type { Metadata } from 'next'
import Link from 'next/link'

import { requireProfile } from '@/lib/auth'
import { fmtDate, fmtNum } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { PointTransaction } from '@/types/db'

export const metadata: Metadata = { title: 'ポイント履歴' }
export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  charge: 'チャージ',
  draw: 'オリパ抽選',
  convert: 'カード交換',
  admin_adjust: '運営による調整',
  refund: '返還',
  bonus: 'ボーナス',
}

export default async function PointHistoryPage() {
  await requireProfile('/points/history')
  const supabase = await createClient()

  const { data } = await supabase
    .from('point_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const txs = (data ?? []) as PointTransaction[]

  return (
    <div className="py-4">
      <Link href="/points" className="text-sm text-ink-dim hover:text-ink">
        ← ポイント
      </Link>
      <h1 className="mt-3 text-2xl font-black">ポイント履歴</h1>

      {txs.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line py-16 text-center text-ink-dim">
          履歴がありません
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {txs.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 bg-surface/40 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {TYPE_LABEL[t.type] ?? t.type}
                </p>
                {t.description && (
                  <p className="truncate text-[11px] text-ink-dim">
                    {t.description}
                  </p>
                )}
                <p className="text-[11px] text-ink-dim">
                  {fmtDate(t.created_at)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-sm font-black tabular-nums ${
                    t.amount >= 0 ? 'text-accent' : 'text-ink-dim'
                  }`}
                >
                  {t.amount >= 0 ? '+' : ''}
                  {fmtNum(t.amount)}
                </p>
                <p className="text-[11px] tabular-nums text-ink-dim">
                  残高 {fmtNum(t.balance_after)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
