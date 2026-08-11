import type { Metadata } from 'next'
import Link from 'next/link'

import { requireProfile } from '@/lib/auth'
import { fmtDate, fmtNum } from '@/lib/format'
import { rarityOf } from '@/lib/rarity'
import { createClient } from '@/lib/supabase/server'
import type { Draw } from '@/types/db'

export const metadata: Metadata = { title: '抽選履歴' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pending: '未選択',
  converted: 'ポイント交換済',
  ship_requested: '発送申請中',
  shipped: '発送済み',
  refunded: '調達不可・返還済み',
}

export default async function DrawHistoryPage() {
  await requireProfile('/mypage/history')
  const supabase = await createClient()

  const { data } = await supabase
    .from('draws')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const draws = (data ?? []) as Draw[]

  return (
    <div className="py-4">
      <Link href="/mypage" className="text-sm text-ink-dim hover:text-ink">
        ← マイページ
      </Link>
      <h1 className="mt-3 text-2xl font-black">抽選履歴</h1>
      <p className="mt-1.5 text-sm text-ink-dim">直近200件を表示しています。</p>

      {draws.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line py-16 text-center text-ink-dim">
          まだ抽選履歴がありません
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {draws.map((d) => {
            const r = rarityOf(d.card_rarity)
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 bg-surface/40 px-4 py-3"
              >
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black text-black"
                  style={{ background: r.color }}
                >
                  {r.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.card_name}</p>
                  <p className="text-[11px] text-ink-dim">
                    {fmtDate(d.created_at)} ／ {fmtNum(d.cost_points)}pt
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-dim">
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
