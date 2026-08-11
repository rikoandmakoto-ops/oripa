'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { fmtDate, fmtNum } from '@/lib/format'
import {
  SHOPS,
  SHOP_ORDER,
  STOCK_STATUS,
  bestSource,
  fmtRate,
  fmtYen,
  margin,
  pointsToYen,
} from '@/lib/procurement'
import type { CardSource, ShopCode, SourceStockStatus } from '@/types/db'

import { addCardSource, deleteCardSource, updateCardSource } from '@/app/admin/actions'

const TONE: Record<string, string> = {
  ok: 'bg-accent/15 text-accent',
  warn: 'bg-gold/15 text-gold',
  bad: 'bg-rarity-s/15 text-rarity-s',
  mute: 'bg-line text-ink-dim',
}

const STOCK_OPTIONS = Object.keys(STOCK_STATUS) as SourceStockStatus[]

type Result = { ok: true; message: string } | { ok: false; error: string }

/**
 * 1枚のカードに紐づく仕入れ先の管理。
 * カード一覧の行を開くと出てくる。
 */
export function CardSourceManager({
  packId,
  cardId,
  cardName,
  pricePoints,
  sources,
}: {
  packId: string
  cardId: string
  cardName: string
  /** 1口の販売価格。利益率の分母になる。 */
  pricePoints: number
  sources: CardSource[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(sources.length === 0)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  const best = bestSource(sources)
  // 1口いくらで売って、その1枚をいくらで仕入れるか
  const m = best ? margin(pointsToYen(pricePoints), best.price) : null

  function run(fn: () => Promise<Result>) {
    startTransition(async () => {
      const res = await fn()
      setFeedback(
        res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error }
      )
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-bg/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold">「{cardName}」の仕入れ先</p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-ink-dim transition hover:text-ink"
        >
          {adding ? '閉じる' : '＋ 仕入れ先を追加'}
        </button>
      </div>

      {m ? (
        <p className="text-[11px] text-ink-dim">
          最安 {fmtYen(best?.price)}（{best?.shop_name}） ／ 1口{' '}
          {fmtNum(pricePoints)}pt ＝ {fmtYen(pointsToYen(pricePoints))} ／ 粗利{' '}
          <span className={m.profit >= 0 ? 'text-accent' : 'text-rarity-s'}>
            {fmtYen(m.profit)}（{fmtRate(m.rate)}）
          </span>
        </p>
      ) : (
        <p className="text-[11px] text-rarity-s">
          調達可能な仕入れ先がありません。このカードが当たると調達できず返還になります。
        </p>
      )}

      {feedback && (
        <p
          className={`rounded-lg px-3 py-2 text-[11px] ${
            feedback.ok
              ? 'bg-accent/10 text-accent'
              : 'bg-rarity-s/10 text-rarity-s'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {adding && (
        <form
          action={(form) => run(() => addCardSource(packId, cardId, form))}
          className="space-y-2.5 rounded-lg border border-line bg-surface/60 p-3"
        >
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-dim">
                ショップ
              </span>
              <select
                name="shop_code"
                defaultValue="yuyutei"
                className="w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-xs outline-none focus:border-brand"
              >
                {SHOP_ORDER.map((code) => (
                  <option key={code} value={code}>
                    {SHOPS[code as ShopCode].label}
                  </option>
                ))}
              </select>
            </label>
            <MiniField
              name="shop_name"
              label="表示名"
              required
              maxLength={80}
              placeholder="遊々亭"
            />
          </div>

          <MiniField
            name="url"
            label="商品URL"
            type="url"
            required
            placeholder="https://…"
          />

          <div className="grid grid-cols-3 gap-2.5">
            <MiniField
              name="price"
              label="仕入価格（円）"
              type="number"
              min={0}
              defaultValue={0}
              required
            />
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-dim">在庫</span>
              <select
                name="stock_status"
                defaultValue="in_stock"
                className="w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-xs outline-none focus:border-brand"
              >
                {STOCK_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STOCK_STATUS[s].label}
                  </option>
                ))}
              </select>
            </label>
            <MiniField
              name="priority"
              label="優先度（1が最優先）"
              type="number"
              min={1}
              max={99}
              defaultValue={sources.length + 1}
              required
            />
          </div>

          <MiniField name="note" label="メモ（任意）" maxLength={300} />

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? '登録中…' : '仕入れ先を登録'}
          </button>
        </form>
      )}

      {sources.length > 0 && (
        <ul className="space-y-2">
          {[...sources]
            .sort((a, b) => a.priority - b.priority || a.price - b.price)
            .map((s) => (
              <li
                key={s.id}
                className={`rounded-lg border p-2.5 ${
                  s.id === best?.id
                    ? 'border-brand/50 bg-brand/5'
                    : 'border-line bg-surface/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">
                      <span className="mr-1.5 text-ink-dim">#{s.priority}</span>
                      {s.shop_name}
                      {!s.is_active && (
                        <span className="ml-1.5 text-[10px] text-ink-dim">
                          （停止中）
                        </span>
                      )}
                    </p>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-0.5 block truncate text-[11px] text-ink-dim underline decoration-line hover:text-brand"
                    >
                      {s.url}
                    </a>
                    <p className="mt-0.5 text-[10px] text-ink-dim">
                      最終確認 {fmtDate(s.last_checked_at)}
                      {s.note && ` ／ ${s.note}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      TONE[STOCK_STATUS[s.stock_status].tone]
                    }`}
                  >
                    {STOCK_STATUS[s.stock_status].label}
                  </span>
                </div>

                <form
                  action={(form) => run(() => updateCardSource(s.id, form))}
                  className="mt-2.5 flex flex-wrap items-center gap-2"
                >
                  <input
                    name="price"
                    type="number"
                    min={0}
                    defaultValue={s.price}
                    aria-label="仕入価格"
                    className="w-24 rounded-lg border border-line bg-bg px-2 py-1.5 text-xs tabular-nums outline-none focus:border-brand"
                  />
                  <select
                    name="stock_status"
                    defaultValue={s.stock_status}
                    aria-label="在庫状態"
                    className="rounded-lg border border-line bg-bg px-2 py-1.5 text-xs outline-none focus:border-brand"
                  >
                    {STOCK_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {STOCK_STATUS[v].label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="priority"
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={s.priority}
                    aria-label="優先度"
                    className="w-16 rounded-lg border border-line bg-bg px-2 py-1.5 text-xs tabular-nums outline-none focus:border-brand"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-ink-dim">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={s.is_active}
                      className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                    />
                    有効
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`「${s.shop_name}」を削除しますか？`)) return
                      run(() => deleteCardSource(packId, s.id))
                    }}
                    className="text-[11px] text-ink-dim transition hover:text-rarity-s disabled:opacity-50"
                  >
                    削除
                  </button>
                </form>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function MiniField({
  name,
  label,
  ...rest
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  // 複数カードのフォームが同時に開かれうるので id は振らず label で包む
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-ink-dim">{label}</span>
      <input
        name={name}
        className="w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-xs outline-none transition placeholder:text-ink-dim/50 focus:border-brand"
        {...rest}
      />
    </label>
  )
}
