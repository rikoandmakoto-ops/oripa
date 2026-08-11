import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CardManager } from '@/components/admin/CardManager'
import { DeletePackButton } from '@/components/admin/DeletePackButton'
import { PackForm } from '@/components/admin/PackForm'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CardSource, OripaCard, OripaPack } from '@/types/db'

export const metadata: Metadata = { title: 'オリパを編集' }
export const dynamic = 'force-dynamic'

export default async function EditPackPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const admin = createAdminClient()

  const { data: pack } = await admin
    .from('oripa_packs')
    .select('*')
    .eq('id', id)
    .single()

  if (!pack) notFound()

  const { data: cards } = await admin
    .from('oripa_cards')
    .select('*')
    .eq('pack_id', id)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: true })

  const cardList = (cards ?? []) as OripaCard[]

  // 仕入れ先はカードごとに引くと N+1 になるので、パック分をまとめて取る
  const { data: sources } = cardList.length
    ? await admin
        .from('card_sources')
        .select('*')
        .in(
          'card_id',
          cardList.map((c) => c.id)
        )
    : { data: [] }

  return (
    <div className="mx-auto max-w-2xl py-4">
      <Link href="/admin" className="text-sm text-ink-dim hover:text-ink">
        ← 管理画面
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-black">{(pack as OripaPack).title}</h1>
        {(pack as OripaPack).is_published && (
          <Link
            href={`/packs/${id}`}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim transition hover:text-ink"
          >
            公開ページを見る →
          </Link>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-black">基本情報</h2>
        <PackForm pack={pack as OripaPack} />
      </section>

      <section className="mt-12">
        <CardManager
          packId={id}
          pricePoints={(pack as OripaPack).price_points}
          cards={cardList}
          sources={(sources ?? []) as CardSource[]}
        />
      </section>

      <section className="mt-16 rounded-2xl border border-rarity-s/30 bg-rarity-s/5 p-5">
        <h2 className="text-sm font-black text-rarity-s">危険な操作</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
          抽選履歴が残っているオリパは削除できません。販売を止めたいだけなら「公開する」のチェックを外してください。
        </p>
        <div className="mt-4">
          <DeletePackButton packId={id} title={(pack as OripaPack).title} />
        </div>
      </section>
    </div>
  )
}
