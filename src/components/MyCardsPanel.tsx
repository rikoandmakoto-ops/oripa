'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { CardVisual } from '@/components/gacha/CardVisual'
import { fmtNum } from '@/lib/format'
import { rarityOf } from '@/lib/rarity'
import type { Draw } from '@/types/db'

import { convertToPoints, requestShipment } from '@/app/mypage/actions'

type Mode = 'idle' | 'shipping'

export function MyCardsPanel({ draws }: { draws: Draw[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<Mode>('idle')
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{
    ok: boolean
    text: string
  } | null>(null)

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const selectedValue = useMemo(
    () =>
      draws
        .filter((d) => selected.has(d.id))
        .reduce((s, d) => s + d.point_value, 0),
    [draws, selected]
  )

  function toggle(id: string) {
    setFeedback(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(draws.map((d) => d.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function doConvert() {
    if (selectedIds.length === 0) return
    if (
      !window.confirm(
        `${selectedIds.length}枚を ${fmtNum(selectedValue)}pt に交換します。\nこの操作は取り消せません。よろしいですか？`
      )
    ) {
      return
    }

    startTransition(async () => {
      const res = await convertToPoints(selectedIds)
      if (res.ok) {
        setFeedback({ ok: true, text: res.message })
        clearSelection()
        router.refresh()
      } else {
        setFeedback({ ok: false, text: res.error })
      }
    })
  }

  function doShip(form: FormData) {
    const payload = {
      recipient_name: String(form.get('recipient_name') ?? ''),
      postal_code: String(form.get('postal_code') ?? ''),
      address: String(form.get('address') ?? ''),
      phone: String(form.get('phone') ?? ''),
      note: String(form.get('note') ?? ''),
    }

    startTransition(async () => {
      const res = await requestShipment(selectedIds, payload)
      if (res.ok) {
        setFeedback({ ok: true, text: res.message })
        clearSelection()
        setMode('idle')
        router.refresh()
      } else {
        setFeedback({ ok: false, text: res.error })
      }
    })
  }

  if (draws.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-16 text-center">
        <p className="font-bold text-ink-dim">未選択のカードはありません</p>
        <p className="mt-2 text-sm text-ink-dim/70">
          オリパを引くと、ここに獲得したカードが並びます。
        </p>
      </div>
    )
  }

  return (
    <div>
      {feedback && (
        <p
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.ok
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-rarity-s/40 bg-rarity-s/10 text-rarity-s'
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="mb-3 flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={selected.size === draws.length ? clearSelection : selectAll}
          className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-dim transition hover:text-ink"
        >
          {selected.size === draws.length ? '選択を解除' : 'すべて選択'}
        </button>
        <span className="text-ink-dim">
          {selected.size} / {draws.length} 枚選択中
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {draws.map((d) => {
          const on = selected.has(d.id)
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              aria-pressed={on}
              className={`relative rounded-xl text-left transition ${
                on ? 'scale-[0.96]' : ''
              }`}
            >
              <CardVisual
                name={d.card_name}
                rarity={d.card_rarity}
                imageUrl={d.card_image_url}
                holo={rarityOf(d.card_rarity).tier >= 3}
                className={on ? 'opacity-70' : ''}
              />
              {on && (
                <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-black text-white">
                  ✓
                </span>
              )}
              <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight">
                {d.card_name}
              </p>
              <p className="text-[11px] text-gold">{fmtNum(d.point_value)}pt</p>
            </button>
          )
        })}
      </div>

      {/* 操作バー */}
      {selected.size > 0 && mode === 'idle' && (
        <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-line bg-bg/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <p className="mb-3 text-center text-sm text-ink-dim">
            選択中 {selected.size}枚 ／ 交換すると{' '}
            <span className="font-bold text-gold">{fmtNum(selectedValue)}pt</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode('shipping')}
              className="flex-1 rounded-xl border border-line bg-surface py-3.5 font-bold transition hover:border-brand disabled:opacity-60"
            >
              発送を申請
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={doConvert}
              className="flex-1 rounded-xl bg-linear-to-r from-gold to-brand py-3.5 font-black text-black transition hover:brightness-110 disabled:opacity-60"
            >
              ポイント交換
            </button>
          </div>
        </div>
      )}

      {/* 発送先入力 */}
      {mode === 'shipping' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
          <div className="mx-auto my-8 w-[min(100%-2rem,32rem)] rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-xl font-black">発送先の入力</h2>
            <p className="mt-1.5 text-sm text-ink-dim">
              選択した {selected.size}枚 をお送りします。
            </p>

            <form action={doShip} className="mt-5 space-y-3">
              <Field
                name="recipient_name"
                label="お名前"
                autoComplete="name"
                required
              />
              <Field
                name="postal_code"
                label="郵便番号"
                placeholder="1234567"
                autoComplete="postal-code"
                inputMode="numeric"
                required
              />
              <Field
                name="address"
                label="住所"
                autoComplete="street-address"
                required
              />
              <Field
                name="phone"
                label="電話番号"
                placeholder="09012345678"
                autoComplete="tel"
                inputMode="tel"
                required
              />
              <Field name="note" label="備考（任意）" />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('idle')}
                  className="flex-1 rounded-xl border border-line py-3 font-bold text-ink-dim transition hover:text-ink"
                >
                  戻る
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-xl bg-linear-to-r from-brand to-brand-2 py-3 font-black text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? '送信中…' : '申請する'}
                </button>
              </div>
            </form>
          </div>
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
        className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-base outline-none transition placeholder:text-ink-dim/50 focus:border-brand"
        {...rest}
      />
    </div>
  )
}
