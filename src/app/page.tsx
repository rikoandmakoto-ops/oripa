import Link from 'next/link'

import { PackCard } from '@/components/PackCard'
import { createClient } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/format'
import type { OripaPack } from '@/types/db'

// 残り口数は常に最新を見せたいのでキャッシュしない
export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('oripa_packs')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data } = await query
  const packs = (data ?? []) as OripaPack[]

  // 絞り込みタブ用に、公開中のパックが持つカテゴリだけを集める
  const { data: allPacks } = await supabase
    .from('oripa_packs')
    .select('category')
    .eq('is_published', true)

  const categories = Array.from(
    new Set((allPacks ?? []).map((p) => p.category as string))
  )

  return (
    <div className="py-4">
      {/* ヒーロー */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-linear-to-br from-brand/20 via-brand-2/15 to-transparent px-6 py-10 text-center">
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">
          どのカードゲームでも、
          <br />
          <span className="text-gradient">当たるまで引ける。</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-dim">
          排出確率と残り在庫をすべて公開。
          <br />
          封入内容は事前に確定しているので、後から中身が変わることはありません。
        </p>
      </section>

      {/* カテゴリ絞り込み */}
      {categories.length > 1 && (
        <nav className="mt-8 flex flex-wrap gap-2">
          <FilterChip href="/" label="すべて" active={!category} />
          {categories.map((c) => (
            <FilterChip
              key={c}
              href={`/?category=${encodeURIComponent(c)}`}
              label={categoryLabel(c)}
              active={category === c}
            />
          ))}
        </nav>
      )}

      {/* パック一覧 */}
      <section className="mt-6">
        {packs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line py-20 text-center">
            <p className="font-bold text-ink-dim">販売中のオリパはありません</p>
            <p className="mt-2 text-sm text-ink-dim/70">
              管理画面から作成すると、ここに並びます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {packs.map((p) => (
              <PackCard key={p.id} pack={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-brand bg-brand/15 text-brand'
          : 'border-line text-ink-dim hover:text-ink'
      }`}
    >
      {label}
    </Link>
  )
}
