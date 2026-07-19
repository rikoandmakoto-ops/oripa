import type { Metadata } from 'next'
import Link from 'next/link'

import { MyCardsPanel } from '@/components/MyCardsPanel'
import { requireProfile } from '@/lib/auth'
import { fmtDate, fmtNum } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { Draw, Shipment } from '@/types/db'

export const metadata: Metadata = { title: 'マイページ' }
export const dynamic = 'force-dynamic'

export default async function MyPage() {
  const profile = await requireProfile('/mypage')
  const supabase = await createClient()

  // 未選択（発送もポイント交換もしていない）カード
  const { data: pending } = await supabase
    .from('draws')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: shipments } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const pendingDraws = (pending ?? []) as Draw[]
  const shipmentList = (shipments ?? []) as Shipment[]

  return (
    <div className="py-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black">マイページ</h1>
          <p className="mt-1 text-sm text-ink-dim">
            {profile.display_name || 'ゲスト'} さん
          </p>
        </div>
        <Link
          href="/points"
          className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-right transition hover:bg-gold/20"
        >
          <span className="block text-[11px] text-gold/80">所持ポイント</span>
          <span className="block text-xl font-black text-gold">
            {fmtNum(profile.points)}
          </span>
        </Link>
      </div>

      <nav className="mt-5 flex gap-2 text-sm">
        <Link
          href="/mypage/history"
          className="rounded-lg border border-line px-3 py-1.5 text-ink-dim transition hover:text-ink"
        >
          抽選履歴
        </Link>
        <Link
          href="/points/history"
          className="rounded-lg border border-line px-3 py-1.5 text-ink-dim transition hover:text-ink"
        >
          ポイント履歴
        </Link>
      </nav>

      <section className="mt-8">
        <h2 className="text-lg font-black">獲得したカード</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
          カードを選んで「発送」か「ポイント交換」を選択してください。
          ポイント交換は取り消せません。
        </p>

        <div className="mt-4">
          <MyCardsPanel draws={pendingDraws} />
        </div>
      </section>

      {shipmentList.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-black">発送状況</h2>
          <ul className="mt-4 space-y-2">
            {shipmentList.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-line bg-surface/60 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">
                    {SHIPMENT_STATUS_LABEL[s.status]}
                  </span>
                  <span className="text-xs text-ink-dim">
                    {fmtDate(s.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-dim">
                  {s.postal_code} {s.address}
                </p>
                {s.tracking_number && (
                  <p className="mt-1 text-xs text-accent">
                    追跡番号：{s.tracking_number}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  requested: '申請受付',
  preparing: '発送準備中',
  shipped: '発送済み',
  cancelled: 'キャンセル',
}
