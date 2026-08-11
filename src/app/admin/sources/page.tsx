import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'

import { requireAdmin } from '@/lib/auth'
import { fmtDate, fmtNum } from '@/lib/format'
import { SHOPS, STOCK_STATUS, fmtYen, isStale, shopLabel } from '@/lib/procurement'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CardSource, OripaCard, ShopCode, SourceStockStatus } from '@/types/db'

export const metadata: Metadata = { title: '仕入れ先一覧' }
export const dynamic = 'force-dynamic'

const TONE: Record<string, string> = {
  ok: 'bg-accent/15 text-accent',
  warn: 'bg-gold/15 text-gold',
  bad: 'bg-rarity-s/15 text-rarity-s',
  mute: 'bg-line text-ink-dim',
}

export default async function AdminSourcesPage() {
  await requireAdmin()

  const admin = createAdminClient()

  const { data: sources } = await admin
    .from('card_sources')
    .select('*')
    .order('last_checked_at', { ascending: true })
    .limit(500)

  const list = (sources ?? []) as CardSource[]

  const { data: cards } = list.length
    ? await admin
        .from('oripa_cards')
        .select('id, name, pack_id, rarity')
        .in('id', [...new Set(list.map((s) => s.card_id))])
    : { data: [] }

  const cardById = new Map(
    ((cards ?? []) as Pick<OripaCard, 'id' | 'name' | 'pack_id' | 'rarity'>[]).map(
      (c) => [c.id, c]
    )
  )

  // 「最終確認からの経過時間」を出すのでリクエスト時刻が要る。
  // connection() を挟んでから時刻に依存する処理をするのが Next 16 の作法。
  await connection()

  const outOfStock = list.filter(
    (s) => s.is_active && s.stock_status === 'out_of_stock'
  )
  const stale = list.filter((s) => s.is_active && isStale(s.last_checked_at))

  return (
    <div className="mx-auto max-w-4xl py-4">
      <Link href="/admin" className="text-sm text-ink-dim hover:text-ink">
        ← 管理画面
      </Link>
      <h1 className="mt-3 text-2xl font-black">仕入れ先一覧</h1>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
        価格と在庫の更新は各オリパの編集画面（カード名をタップ）から行います。
        Phase 1 は手動更新です。自動巡回は Phase 2 で対応予定。
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="登録数" value={fmtNum(list.length)} />
        <Stat
          label="在庫切れ"
          value={fmtNum(outOfStock.length)}
          tone={outOfStock.length > 0 ? 'bad' : undefined}
        />
        <Stat
          label="24時間以上未確認"
          value={fmtNum(stale.length)}
          tone={stale.length > 0 ? 'warn' : undefined}
        />
      </dl>

      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line py-16 text-center text-ink-dim">
          仕入れ先はまだ登録されていません
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-surface text-xs text-ink-dim">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">カード</th>
                <th className="px-3 py-2.5 text-left font-medium">ショップ</th>
                <th className="px-3 py-2.5 text-right font-medium">価格</th>
                <th className="px-3 py-2.5 text-center font-medium">在庫</th>
                <th className="px-3 py-2.5 text-right font-medium">優先度</th>
                <th className="px-3 py-2.5 text-left font-medium">最終確認</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const card = cardById.get(s.card_id)
                const outdated = isStale(s.last_checked_at)

                return (
                  <tr
                    key={s.id}
                    className={`border-t border-line ${s.is_active ? '' : 'opacity-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      {card ? (
                        <Link
                          href={`/admin/packs/${card.pack_id}`}
                          className="underline decoration-line hover:text-brand"
                        >
                          {card.name}
                        </Link>
                      ) : (
                        <span className="text-ink-dim">（削除済み）</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline decoration-line hover:text-brand"
                      >
                        {s.shop_name}
                      </a>
                      <span className="ml-1.5 text-[10px] text-ink-dim">
                        {shopLabel(s.shop_code)}
                        {SHOPS[s.shop_code as ShopCode]?.auto !== 'manual' &&
                          '・自動巡回予定'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {fmtYen(s.price)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          TONE[STOCK_STATUS[s.stock_status as SourceStockStatus].tone]
                        }`}
                      >
                        {STOCK_STATUS[s.stock_status as SourceStockStatus].label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-dim">
                      #{s.priority}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-xs ${
                        outdated ? 'text-gold' : 'text-ink-dim'
                      }`}
                    >
                      {fmtDate(s.last_checked_at)}
                    </td>
                  </tr>
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
  tone?: 'warn' | 'bad'
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 px-3 py-3.5">
      <dt className="text-[11px] text-ink-dim">{label}</dt>
      <dd
        className={`mt-1 text-lg font-black tabular-nums ${
          tone === 'bad' ? 'text-rarity-s' : tone === 'warn' ? 'text-gold' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
