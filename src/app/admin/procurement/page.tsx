import type { Metadata } from 'next'
import Link from 'next/link'

import { ProcurementRow } from '@/components/admin/ProcurementRow'
import { requireAdmin } from '@/lib/auth'
import { fmtNum } from '@/lib/format'
import {
  PROCUREMENT_FILTERS,
  filterToStatuses,
  isProcurementFilter,
} from '@/lib/procurement'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  CardSource,
  Draw,
  ProcurementTask,
  Shipment,
} from '@/types/db'

export const metadata: Metadata = { title: '調達タスク' }
export const dynamic = 'force-dynamic'

export default async function AdminProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()

  const { status } = await searchParams
  const filter = isProcurementFilter(status) ? status : 'open'
  const statuses = filterToStatuses(filter)

  const admin = createAdminClient()

  let query = admin
    .from('procurement_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (statuses) query = query.in('status', statuses)

  const { data } = await query
  const tasks = (data ?? []) as ProcurementTask[]

  // 関連データはまとめて引く（N+1 回避）
  const [drawsRes, shipmentsRes, sourcesRes] = await Promise.all([
    tasks.length
      ? admin.from('draws').select('*').in('id', tasks.map((t) => t.draw_id))
      : Promise.resolve({ data: [] }),
    tasks.length
      ? admin
          .from('shipments')
          .select('*')
          .in(
            'id',
            [...new Set(tasks.map((t) => t.shipment_id).filter(Boolean))] as string[]
          )
      : Promise.resolve({ data: [] }),
    tasks.length
      ? admin
          .from('card_sources')
          .select('*')
          .in('card_id', [...new Set(tasks.map((t) => t.card_id))])
      : Promise.resolve({ data: [] }),
  ])

  const drawById = new Map(
    ((drawsRes.data ?? []) as Draw[]).map((d) => [d.id, d])
  )
  const shipmentById = new Map(
    ((shipmentsRes.data ?? []) as Shipment[]).map((s) => [s.id, s])
  )

  const sourcesByCard = new Map<string, CardSource[]>()
  for (const s of (sourcesRes.data ?? []) as CardSource[]) {
    const arr = sourcesByCard.get(s.card_id) ?? []
    arr.push(s)
    sourcesByCard.set(s.card_id, arr)
  }

  return (
    <div className="mx-auto max-w-3xl py-4">
      <Link href="/admin" className="text-sm text-ink-dim hover:text-ink">
        ← 管理画面
      </Link>
      <h1 className="mt-3 text-2xl font-black">調達タスク</h1>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
        発送申請が入ったカードを仕入れ先から調達します。調達できなかった場合は
        「失敗」にすると、ユーザーへポイントが自動で全額返還されます。
      </p>

      <nav className="mt-5 flex flex-wrap gap-2">
        {PROCUREMENT_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/procurement?status=${f.value}`}
            className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              filter === f.value
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-line text-ink-dim hover:text-ink'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {tasks.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line py-16 text-center text-ink-dim">
          該当する調達タスクはありません
        </p>
      ) : (
        <>
          <p className="mt-5 text-xs text-ink-dim">{fmtNum(tasks.length)}件</p>
          <ul className="mt-2 space-y-3">
            {tasks.map((t) => (
              <ProcurementRow
                key={t.id}
                task={t}
                draw={drawById.get(t.draw_id) ?? null}
                shipment={t.shipment_id ? (shipmentById.get(t.shipment_id) ?? null) : null}
                sources={sourcesByCard.get(t.card_id) ?? []}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
