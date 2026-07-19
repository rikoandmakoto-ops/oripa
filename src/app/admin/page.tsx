import type { Metadata } from 'next'
import Link from 'next/link'

import { requireAdmin } from '@/lib/auth'
import { categoryLabel, fmtNum } from '@/lib/format'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OripaPack } from '@/types/db'

export const metadata: Metadata = { title: '管理画面' }
export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  await requireAdmin()

  // 非公開パックも見る必要があるので service_role で読む
  const admin = createAdminClient()

  const { data } = await admin
    .from('oripa_packs')
    .select('*')
    .order('created_at', { ascending: false })

  const packs = (data ?? []) as OripaPack[]

  const { count: pendingShipments } = await admin
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .in('status', ['requested', 'preparing'])

  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">管理画面</h1>
        <Link
          href="/admin/packs/new"
          className="rounded-xl bg-linear-to-r from-brand to-brand-2 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
        >
          ＋ オリパを作成
        </Link>
      </div>

      <Link
        href="/admin/shipments"
        className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-surface/60 px-5 py-4 transition hover:border-brand"
      >
        <span className="font-bold">発送管理</span>
        <span className="text-sm text-ink-dim">
          未処理{' '}
          <span className="font-black text-brand">
            {fmtNum(pendingShipments ?? 0)}
          </span>{' '}
          件 →
        </span>
      </Link>

      <h2 className="mt-10 text-lg font-black">オリパ一覧</h2>

      {packs.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line py-16 text-center text-ink-dim">
          まだオリパがありません
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {packs.map((p) => {
            const soldRatio =
              p.total_slots > 0
                ? (p.total_slots - p.remaining_slots) / p.total_slots
                : 0
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/packs/${p.id}`}
                  className="block rounded-2xl border border-line bg-surface/60 p-4 transition hover:border-brand"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{p.title}</p>
                      <p className="mt-0.5 text-xs text-ink-dim">
                        {categoryLabel(p.category)} ／{' '}
                        {fmtNum(p.price_points)}pt
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${
                        p.is_published
                          ? 'bg-accent/15 text-accent'
                          : 'bg-line text-ink-dim'
                      }`}
                    >
                      {p.is_published ? '公開中' : '非公開'}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-brand to-gold"
                        style={{ width: `${Math.round(soldRatio * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-dim">
                      残り {fmtNum(p.remaining_slots)} / {fmtNum(p.total_slots)} 口
                      （消化率 {Math.round(soldRatio * 100)}%）
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
