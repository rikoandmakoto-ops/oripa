'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { fmtNum, fmtProbability } from '@/lib/format'
import { RARITY, RARITY_ORDER } from '@/lib/rarity'
import type { OripaCard, Rarity } from '@/types/db'

import { addCard, deleteCard } from '@/app/admin/actions'

export function CardManager({
  packId,
  cards,
}: {
  packId: string
  cards: OripaCard[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(cards.length === 0)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  const totalStock = cards.reduce((s, c) => s + c.stock, 0)
  const totalRemaining = cards.reduce((s, c) => s + c.remaining, 0)

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
        残り {fmtNum(totalRemaining)}口）。
      </p>

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
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-black text-black"
                        style={{ background: RARITY[c.rarity as Rarity].color }}
                      >
                        {RARITY[c.rarity as Rarity].label}
                      </span>
                      <span className="truncate">{c.name}</span>
                      {c.is_hit && (
                        <span className="shrink-0 text-[10px] text-gold">
                          ★目玉
                        </span>
                      )}
                    </div>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
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
