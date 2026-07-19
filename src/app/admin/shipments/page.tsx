import type { Metadata } from 'next'
import Link from 'next/link'

import { ShipmentRow } from '@/components/admin/ShipmentRow'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Draw, Shipment } from '@/types/db'

export const metadata: Metadata = { title: '発送管理' }
export const dynamic = 'force-dynamic'

export default async function AdminShipmentsPage() {
  await requireAdmin()

  const admin = createAdminClient()

  const { data: shipments } = await admin
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const list = (shipments ?? []) as Shipment[]

  // 各申請に含まれるカードをまとめて引く（N+1 を避ける）
  const { data: draws } = await admin
    .from('draws')
    .select('*')
    .in(
      'shipment_id',
      list.map((s) => s.id)
    )

  const itemsByShipment = new Map<string, Draw[]>()
  for (const d of (draws ?? []) as Draw[]) {
    if (!d.shipment_id) continue
    const arr = itemsByShipment.get(d.shipment_id) ?? []
    arr.push(d)
    itemsByShipment.set(d.shipment_id, arr)
  }

  return (
    <div className="mx-auto max-w-3xl py-4">
      <Link href="/admin" className="text-sm text-ink-dim hover:text-ink">
        ← 管理画面
      </Link>
      <h1 className="mt-3 text-2xl font-black">発送管理</h1>

      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line py-16 text-center text-ink-dim">
          発送申請はまだありません
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((s) => (
            <ShipmentRow
              key={s.id}
              shipment={s}
              items={itemsByShipment.get(s.id) ?? []}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
