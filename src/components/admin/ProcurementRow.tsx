'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { fmtDate, fmtNum } from '@/lib/format'
import {
  PROCUREMENT_STATUS,
  PROCUREMENT_STATUS_ORDER,
  bestSource,
  fmtRate,
  fmtYen,
  margin,
  pointsToYen,
} from '@/lib/procurement'
import { RARITY } from '@/lib/rarity'
import type {
  CardSource,
  Draw,
  ProcurementStatus,
  ProcurementTask,
  Rarity,
  Shipment,
} from '@/types/db'

import { updateProcurementTask } from '@/app/admin/actions'

const TONE: Record<string, string> = {
  ok: 'bg-accent/15 text-accent',
  warn: 'bg-gold/15 text-gold',
  bad: 'bg-rarity-s/15 text-rarity-s',
  mute: 'bg-line text-ink-dim',
}

export function ProcurementRow({
  task,
  draw,
  shipment,
  sources,
}: {
  task: ProcurementTask
  draw: Draw | null
  shipment: Shipment | null
  /** このカードに登録されている仕入れ先 */
  sources: CardSource[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<ProcurementStatus>(task.status)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  const best = bestSource(sources)
  const recommended = task.source_id
    ? (sources.find((s) => s.id === task.source_id) ?? best)
    : best

  // 実際の支払いが分かっていればそれで、まだなら最安の仕入れ先で粗利を出す
  const costYen = task.purchase_price ?? recommended?.price ?? null
  const m =
    draw && costYen !== null ? margin(pointsToYen(draw.cost_points), costYen) : null

  const meta = PROCUREMENT_STATUS[task.status]

  function onSubmit(form: FormData) {
    startTransition(async () => {
      const res = await updateProcurementTask(task.id, form)
      setFeedback(
        res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error }
      )
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
          <div className="flex items-center gap-2">
            {draw && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black text-black"
                style={{ background: RARITY[draw.card_rarity as Rarity].color }}
              >
                {RARITY[draw.card_rarity as Rarity].label}
              </span>
            )}
            <p className="truncate font-bold">
              {draw?.card_name ?? '（カード情報なし）'}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-ink-dim">
            {shipment ? shipment.recipient_name : '宛先未設定'} ／{' '}
            {fmtDate(task.created_at)}
          </p>
          <p className="mt-0.5 text-xs text-ink-dim">
            仕入 {costYen === null ? '未登録' : fmtYen(costYen)}
            {m && (
              <>
                {' '}／ 粗利{' '}
                <span className={m.profit >= 0 ? 'text-accent' : 'text-rarity-s'}>
                  {fmtYen(m.profit)}（{fmtRate(m.rate)}）
                </span>
              </>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${TONE[meta.tone]}`}
        >
          {meta.label}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-line pt-4">
          {shipment && (
            <p className="text-xs text-ink-dim">
              〒{shipment.postal_code} {shipment.address} ／ {shipment.phone}
            </p>
          )}

          {sources.length === 0 ? (
            <p className="mt-3 rounded-lg bg-rarity-s/10 px-3 py-2 text-[11px] text-rarity-s">
              このカードには仕入れ先が登録されていません。調達できない場合は
              「失敗」にすると
              {draw &&
                `${fmtNum(Math.max(draw.cost_points, draw.point_value))}pt`}
              が自動返還されます。
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {[...sources]
                .sort((a, b) => a.priority - b.priority || a.price - b.price)
                .map((s) => (
                  <li key={s.id} className="text-xs">
                    <span className="text-ink-dim">#{s.priority}</span>{' '}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline decoration-line hover:text-brand"
                    >
                      {s.shop_name}
                    </a>{' '}
                    <span className="tabular-nums">{fmtYen(s.price)}</span>
                    {!s.is_active && (
                      <span className="ml-1 text-[10px] text-ink-dim">（停止中）</span>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {task.refunded_points > 0 && (
            <p className="mt-3 text-xs text-rarity-s">
              返還済み：{fmtNum(task.refunded_points)}pt
              {task.failure_reason && ` ／ 理由：${task.failure_reason}`}
            </p>
          )}

          {feedback && (
            <p
              className={`mt-3 text-sm ${
                feedback.ok ? 'text-accent' : 'text-rarity-s'
              }`}
            >
              {feedback.text}
            </p>
          )}

          <form action={onSubmit} className="mt-4 space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <select
                name="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as ProcurementStatus)
                }
                aria-label="調達ステータス"
                className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand"
              >
                {PROCUREMENT_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {PROCUREMENT_STATUS[s].label}
                  </option>
                ))}
              </select>

              <select
                name="source_id"
                defaultValue={task.source_id ?? recommended?.id ?? ''}
                aria-label="仕入れ先"
                className="min-w-40 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand"
              >
                <option value="">仕入れ先を選択</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shop_name}（{fmtYen(s.price)}）
                  </option>
                ))}
              </select>

              <input
                name="purchase_price"
                type="number"
                min={0}
                placeholder="実際の支払額(円)"
                defaultValue={task.purchase_price ?? ''}
                aria-label="実際の支払額"
                className="w-36 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm tabular-nums outline-none placeholder:text-ink-dim/50 focus:border-brand"
              />
            </div>

            {status === 'failed' && (
              <input
                name="failure_reason"
                required
                maxLength={300}
                placeholder="失敗理由（例：全ショップ在庫切れ）"
                defaultValue={task.failure_reason}
                aria-label="失敗理由"
                className="w-full rounded-xl border border-rarity-s/40 bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-ink-dim/50 focus:border-rarity-s"
              />
            )}

            <input
              name="admin_note"
              maxLength={500}
              placeholder="担当者メモ（任意）"
              defaultValue={task.admin_note}
              aria-label="担当者メモ"
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-ink-dim/50 focus:border-brand"
            />

            {status === 'failed' && task.refunded_points === 0 && draw && (
              <p className="text-[11px] text-rarity-s">
                保存すると {fmtNum(Math.max(draw.cost_points, draw.point_value))}
                pt がユーザーへ自動返還されます。この操作は取り消せません。
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? '保存中…' : '更新'}
            </button>
          </form>
        </div>
      )}
    </li>
  )
}
