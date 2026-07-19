'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { fmtDate } from '@/lib/format'
import { RARITY } from '@/lib/rarity'
import type { Draw, Rarity, Shipment } from '@/types/db'

import { updateShipment } from '@/app/admin/actions'

const STATUS_OPTIONS: { value: Shipment['status']; label: string }[] = [
  { value: 'requested', label: '申請受付' },
  { value: 'preparing', label: '発送準備中' },
  { value: 'shipped', label: '発送済み' },
  { value: 'cancelled', label: 'キャンセル' },
]

export function ShipmentRow({
  shipment,
  items,
}: {
  shipment: Shipment
  items: Draw[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  function onSubmit(form: FormData) {
    startTransition(async () => {
      const res = await updateShipment(shipment.id, form)
      setFeedback(res.ok ? res.message : res.error)
      if (res.ok) router.refresh()
    })
  }

  return (
    <li className="rounded-2xl border border-line bg-surface/60 p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-bold">{shipment.recipient_name}</p>
          <p className="mt-0.5 text-xs text-ink-dim">
            〒{shipment.postal_code} {shipment.address}
          </p>
          <p className="mt-0.5 text-xs text-ink-dim">
            {items.length}枚 ／ {fmtDate(shipment.created_at)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${
            shipment.status === 'shipped'
              ? 'bg-accent/15 text-accent'
              : shipment.status === 'cancelled'
                ? 'bg-line text-ink-dim'
                : 'bg-brand/15 text-brand'
          }`}
        >
          {STATUS_OPTIONS.find((o) => o.value === shipment.status)?.label}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs text-ink-dim">電話：{shipment.phone}</p>
          {shipment.note && (
            <p className="mt-1 text-xs text-ink-dim">備考：{shipment.note}</p>
          )}

          <ul className="mt-3 space-y-1">
            {items.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs">
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-black text-black"
                  style={{ background: RARITY[d.card_rarity as Rarity].color }}
                >
                  {RARITY[d.card_rarity as Rarity].label}
                </span>
                {d.card_name}
              </li>
            ))}
          </ul>

          {feedback && (
            <p className="mt-3 text-sm text-accent">{feedback}</p>
          )}

          <form action={onSubmit} className="mt-4 flex flex-wrap gap-2">
            <select
              name="status"
              defaultValue={shipment.status}
              className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <input
              name="tracking_number"
              placeholder="追跡番号（任意）"
              defaultValue={shipment.tracking_number ?? ''}
              className="min-w-40 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-ink-dim/50 focus:border-brand"
            />

            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? '保存中…' : '更新'}
            </button>
          </form>
        </div>
      )}
    </li>
  )
}
