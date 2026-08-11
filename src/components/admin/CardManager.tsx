'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { fmtNum, fmtProbability } from '@/lib/format'
import { bestSource, fmtRate, fmtYen, packMargin } from '@/lib/procurement'
import { RARITY, RARITY_ORDER } from '@/lib/rarity'
import type { CardSource, OripaCard, Rarity } from '@/types/db'

import { CardSourceManager } from '@/components/admin/CardSourceManager'

import { addCard, deleteCard } from '@/app/admin/actions'

export function CardManager({
  packId,
  pricePoints,
  cards,
  sources,
}: {
  packId: string
  /** 1口の販売価格。仕入れ先ごとの粗利表示に使う。 */
  pricePoints: number
  cards: OripaCard[]
  sources: CardSource[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(cards.length === 0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  const totalStock = cards.reduce((s, c) => s + c.stock, 0)
  const totalRemaining = cards.reduce((s, c) => s + c.remaining, 0)

  const sourcesByCard = new Map<string, CardSource[]>()
  for (const s of sources) {
    const arr = sourcesByCard.get(s.card_id) ?? []
    arr.push(s)
    sourcesByCard.set(s.card_id, arr)
  }

  // 総口数 = 封入数の合計。全部売れたときの売上と原価を出す。
  const packProfit = packMargin(pricePoints, totalStock, cards, sourcesByCard)

  function onAdd(form: FormData) {
    startTransition(async () => {
      const res = await addCard(packId, form)
      setFeedback(
        res.ok
          ? { ok: true, text: res.message }
          : { ok: false, text: res.error }
      )
      if (res.ok) router.refresh()
    })
  }

  function onDelete(cardId: string, name: string) {
    if (!window.confirm(`「${name}」を削除しますか？`)) return
    startTransition(async () => {
      const res = await deleteCard(packId, cardId)
      setFeedback(
        res.ok
          ? { ok: true, text: res.message }
          : { ok: false, text: res.error }
      )
      if (res.ok) router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">封入カード</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-dim transition hover:text-ink"
        >
          {open ? '閉じる' : '＋ カードを追加'}
        </button>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
        封入数の合計がそのまま総口数になります（現在 {fmtNum(totalStock)}口 ／
        残り {fmtNum(totalRemaining)}口）。カード名をタップすると仕入れ先を登録できます。
      </p>

      {cards.length > 0 && (
        <div className="mt-3 rounded-2xl border border-line bg-surface/60 p-4">
          <p className="text-xs font-black">想定利益（全口が売れた場合）</p>
          <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <Stat label="想定売上" value={fmtYen(packProfit.revenue)} />
            <Stat label="想定原価" value={fmtYen(packProfit.cost)} />
            <Stat
              label="粗利"
              value={`${fmtYen(packProfit.profit)}（${fmtRate(packProfit.rate)}）`}
              tone={packProfit.profit >= 0 ? 'ok' : 'bad'}
            />
          </dl>
          {packProfit.unsourcedCards > 0 && (
            <p className="mt-2.5 text-[11px] text-rarity-s">
              仕入れ先が未登録のカードが {packProfit.unsourcedCards}
              種類あります。原価に含まれていないため、実際の利益率はこれより低くなります。
            </p>
          )}
        </div>
      )}

      {feedback && (
        <p
          className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.ok
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-rarity-s/40 bg-rarity-s/10 text-rarity-s'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {open && (
        <form
          action={onAdd}
          className="mt-4 space-y-3 rounded-2xl border border-line bg-surface/60 p-4"
        >
          <Field name="name" label="カード名" required maxLength={120} />
          <Field
            name="image_url"
            label="画像URL（任意）"
            type="url"
            placeholder="https://…"
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="rarity" className="mb-1 block text-xs text-ink-dim">
                レアリティ
              </label>
              <select
                id="rarity"
                name="rarity"
                defaultValue="C"
                className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand"
              >
                {RARITY_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {RARITY[r].label}
                  </option>
                ))}
              </select>
            </div>
            <Field
              name="stock"
              label="封入数"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
            <Field
              name="point_value"
              label="交換pt"
              type="number"
              min={0}
              defaultValue={0}
              required
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="is_hit"
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            目玉カードとして大きく表示する
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-brand py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? '追加中…' : 'カードを追加'}
          </button>
        </form>
      )}

      {cards.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs text-ink-dim">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">カード</th>
                <th className="px-3 py-2.5 text-right font-medium">残/封入</th>
                <th className="px-3 py-2.5 text-right font-medium">確率</th>
                <th className="px-3 py-2.5 text-right font-medium">交換pt</th>
                <th className="px-3 py-2.5 text-right font-medium">仕入れ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const cardSources = sourcesByCard.get(c.id) ?? []
                const best = bestSource(cardSources)
                const isOpen = expanded === c.id

                return (
                  <React.Fragment key={c.id}>
                    <tr className="border-t border-line">
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : c.id)}
                          className="flex w-full items-center gap-2 text-left"
                        >
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-black text-black"
                            style={{
                              background: RARITY[c.rarity as Rarity].color,
                            }}
                          >
                            {RARITY[c.rarity as Rarity].label}
                          </span>
                          <span className="truncate">{c.name}</span>
                          {c.is_hit && (
                            <span className="shrink-0 text-[10px] text-gold">
                              ★目玉
                            </span>
                          )}
                          <span className="shrink-0 text-[10px] text-ink-dim">
                            {isOpen ? '▲' : '▼'}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-dim">
                        {c.remaining}/{c.stock}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {fmtProbability(c.remaining, totalRemaining)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gold">
                        {fmtNum(c.point_value)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {best ? (
                          fmtYen(best.price)
                        ) : (
                          <span
                            className="text-rarity-s"
                            title="調達可能な仕入れ先が未登録です"
                          >
                            未登録
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onDelete(c.id, c.name)}
                          className="text-xs text-ink-dim transition hover:text-rarity-s disabled:opacity-50"
                        >
                          削除
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-t border-line">
                        <td colSpan={6} className="bg-bg/40 p-2.5">
                          <CardSourceManager
                            packId={packId}
                            cardId={c.id}
                            cardName={c.name}
                            pricePoints={pricePoints}
                            sources={cardSources}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'bad'
}) {
  return (
    <div className="rounded-xl bg-bg/60 px-2 py-2.5">
      <dt className="text-[10px] text-ink-dim">{label}</dt>
      <dd
        className={`mt-0.5 text-xs font-black tabular-nums ${
          tone === 'ok' ? 'text-accent' : tone === 'bad' ? 'text-rarity-s' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function Field({
  name,
  label,
  ...rest
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs text-ink-dim">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none transition placeholder:text-ink-dim/50 focus:border-brand"
        {...rest}
      />
    </div>
  )
}
