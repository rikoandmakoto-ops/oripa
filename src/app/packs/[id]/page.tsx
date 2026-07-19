import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { CardVisual } from '@/components/gacha/CardVisual'
import { DrawPanel } from '@/components/gacha/DrawPanel'
import { getProfile } from '@/lib/auth'
import { categoryLabel, fmtNum, fmtProbability } from '@/lib/format'
import { RARITY_ORDER, rarityOf } from '@/lib/rarity'
import { createClient } from '@/lib/supabase/server'
import type { OripaCard, OripaPack } from '@/types/db'

export const dynamic = 'force-dynamic'

async function getPack(id: string) {
  const supabase = await createClient()

  const { data: pack } = await supabase
    .from('oripa_packs')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (!pack) return null

  const { data: cards } = await supabase
    .from('oripa_cards')
    .select('*')
    .eq('pack_id', id)
    .order('sort_order', { ascending: false })

  return { pack: pack as OripaPack, cards: (cards ?? []) as OripaCard[] }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const found = await getPack(id)
  if (!found) return { title: 'オリパが見つかりません' }
  return {
    title: found.pack.title,
    description: found.pack.description,
  }
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const found = await getPack(id)
  if (!found) notFound()

  const { pack, cards } = found
  const profile = await getProfile()

  // 排出確率は「残り本数 ÷ 残り総数」で常に導出する。
  // 管理者が任意に確率をいじれる設計にはしていない。
  const totalRemaining = cards.reduce((s, c) => s + c.remaining, 0)
  const hitCards = cards.filter((c) => c.is_hit)

  return (
    <div className="py-4">
      {/* ヘッダー */}
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="relative aspect-[16/9] bg-surface">
          {pack.image_url ? (
            <Image
              src={pack.image_url}
              alt={pack.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-linear-to-br from-brand/30 via-brand-2/25 to-accent/20">
              <span className="text-5xl font-black text-white/25">ORIPA</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <span className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink-dim">
          {categoryLabel(pack.category)}
        </span>
        <h1 className="mt-2.5 text-2xl font-black leading-snug">{pack.title}</h1>
        {pack.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">
            {pack.description}
          </p>
        )}
      </div>

      {/* 在庫サマリ */}
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="1口あたり" value={`${fmtNum(pack.price_points)}pt`} accent />
        <Stat label="残り口数" value={fmtNum(pack.remaining_slots)} />
        <Stat label="総口数" value={fmtNum(pack.total_slots)} />
      </dl>

      {/* 目玉カード */}
      {hitCards.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-black">
            <span className="text-gradient">目玉カード</span>
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {hitCards.map((c) => (
              <div key={c.id}>
                <CardVisual
                  name={c.name}
                  rarity={c.rarity}
                  imageUrl={c.image_url}
                  holo={rarityOf(c.rarity).tier >= 3}
                />
                <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight">
                  {c.name}
                </p>
                <p className="text-[11px] text-ink-dim">
                  残り {c.remaining}/{c.stock}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 排出確率表 */}
      <section className="mt-8">
        <h2 className="text-lg font-black">封入内容と排出確率</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
          確率は現在の残り在庫から算出しています。引かれるたびに実際の在庫が減り、確率も変動します。
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs text-ink-dim">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">カード</th>
                <th className="px-3 py-2.5 text-right font-medium">残り</th>
                <th className="px-3 py-2.5 text-right font-medium">確率</th>
                <th className="px-3 py-2.5 text-right font-medium">交換pt</th>
              </tr>
            </thead>
            <tbody>
              {RARITY_ORDER.map((rank) => {
                const group = cards.filter((c) => c.rarity === rank)
                if (group.length === 0) return null
                const style = rarityOf(rank)

                return group.map((c, i) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {i === 0 && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-black text-black"
                            style={{ background: style.color }}
                          >
                            {style.label}
                          </span>
                        )}
                        <span
                          className={
                            c.remaining === 0 ? 'text-ink-dim line-through' : ''
                          }
                        >
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-dim">
                      {c.remaining}/{c.stock}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {fmtProbability(c.remaining, totalRemaining)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gold">
                      {fmtNum(c.point_value)}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 rounded-xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-ink-dim">
        獲得したカードは、マイページから「発送」または「ポイント交換」を選択できます。
        ポイントの現金への払い戻しは行っておりません。18歳未満の方はご利用いただけません。
      </p>

      {/* 引くボタン（画面下に固定） */}
      <div className="mt-8">
        <DrawPanel
          pack={pack}
          isLoggedIn={!!profile}
          balance={profile?.points ?? 0}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/60 px-3 py-3 text-center">
      <dt className="text-[11px] text-ink-dim">{label}</dt>
      <dd
        className={`mt-1 text-lg font-black tabular-nums ${
          accent ? 'text-gold' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
