'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; error: string }

/** service_role を使う前に必ず通す。管理者以外は弾く。 */
async function assertAdmin(): Promise<string | null> {
  const profile = await getProfile()
  if (!profile) return 'ログインが必要です。'
  if (!profile.is_admin) return '権限がありません。'
  return null
}

/**
 * パックの口数をカードの在庫から再計算する。
 * total_slots / remaining_slots を手入力させると必ずズレるので、
 * カードを触るたびにここで揃える。
 */
async function recalcPackSlots(packId: string) {
  const admin = createAdminClient()

  const { data: cards } = await admin
    .from('oripa_cards')
    .select('stock, remaining')
    .eq('pack_id', packId)

  const total = (cards ?? []).reduce((s, c) => s + (c.stock as number), 0)
  const remaining = (cards ?? []).reduce(
    (s, c) => s + (c.remaining as number),
    0
  )

  await admin
    .from('oripa_packs')
    .update({ total_slots: Math.max(total, 1), remaining_slots: remaining })
    .eq('id', packId)
}

/* ================================================================
   パック
   ================================================================ */

const PackSchema = z.object({
  title: z.string().trim().min(1, 'タイトルを入力してください').max(120),
  description: z.string().trim().max(2000).optional().default(''),
  image_url: z.string().trim().url().or(z.literal('')).optional().default(''),
  category: z.string().trim().min(1).max(40),
  price_points: z.coerce.number().int().min(1, '価格は1pt以上にしてください'),
  max_draw_per_try: z.coerce.number().int().min(1).max(100),
  is_published: z.coerce.boolean(),
})

function parsePackForm(form: FormData) {
  return PackSchema.safeParse({
    title: form.get('title'),
    description: form.get('description') ?? '',
    image_url: form.get('image_url') ?? '',
    category: form.get('category'),
    price_points: form.get('price_points'),
    max_draw_per_try: form.get('max_draw_per_try'),
    is_published: form.get('is_published') === 'on',
  })
}

export async function createPack(form: FormData): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return { ok: false, error: denied }

  const parsed = parsePackForm(form)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '入力エラー' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('oripa_packs')
    .insert({
      ...parsed.data,
      image_url: parsed.data.image_url || null,
      // カードを登録するまでは 0 口。カード追加時に recalc される。
      total_slots: 1,
      remaining_slots: 0,
      // カードが1枚も無いうちに公開されると引けないので、必ず非公開で作る
      is_published: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error('createPack failed', error)
    return { ok: false, error: 'オリパの作成に失敗しました。' }
  }

  revalidatePath('/admin')
  return { ok: true, message: '作成しました。カードを登録してください。', id: data.id }
}

export async function updatePack(
  packId: string,
  form: FormData
): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return { ok: false, error: denied }

  const parsed = parsePackForm(form)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '入力エラー' }
  }

  const admin = createAdminClient()

  // カードが1枚も無いまま公開させない（引いた瞬間 SOLD_OUT になるため）
  if (parsed.data.is_published) {
    const { count } = await admin
      .from('oripa_cards')
      .select('id', { count: 'exact', head: true })
      .eq('pack_id', packId)

    if (!count) {
      return {
        ok: false,
        error: 'カードが1枚も登録されていないため公開できません。',
      }
    }
  }

  const { error } = await admin
    .from('oripa_packs')
    .update({ ...parsed.data, image_url: parsed.data.image_url || null })
    .eq('id', packId)

  if (error) {
    console.error('updatePack failed', error)
    return { ok: false, error: '更新に失敗しました。' }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/packs/${packId}`)
  revalidatePath(`/packs/${packId}`)
  return { ok: true, message: '更新しました。' }
}

export async function deletePack(packId: string): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return { ok: false, error: denied }

  const admin = createAdminClient()

  // 抽選履歴が1件でもあるパックは消させない（履歴が壊れるため）
  const { count } = await admin
    .from('draws')
    .select('id', { count: 'exact', head: true })
    .eq('pack_id', packId)

  if (count) {
    return {
      ok: false,
      error: `抽選履歴が${count}件あるため削除できません。非公開にしてください。`,
    }
  }

  const { error } = await admin.from('oripa_packs').delete().eq('id', packId)
  if (error) {
    console.error('deletePack failed', error)
    return { ok: false, error: '削除に失敗しました。' }
  }

  revalidatePath('/admin')
  return { ok: true, message: '削除しました。' }
}

/* ================================================================
   カード
   ================================================================ */

const CardSchema = z.object({
  name: z.string().trim().min(1, 'カード名を入力してください').max(120),
  image_url: z.string().trim().url().or(z.literal('')).optional().default(''),
  rarity: z.enum(['S', 'A', 'B', 'C', 'D']),
  stock: z.coerce.number().int().min(1, '封入数は1以上にしてください').max(100000),
  point_value: z.coerce.number().int().min(0).max(10000000),
  is_hit: z.coerce.boolean(),
})

export async function addCard(
  packId: string,
  form: FormData
): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return { ok: false, error: denied }

  const parsed = CardSchema.safeParse({
    name: form.get('name'),
    image_url: form.get('image_url') ?? '',
    rarity: form.get('rarity'),
    stock: form.get('stock'),
    point_value: form.get('point_value'),
    is_hit: form.get('is_hit') === 'on',
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '入力エラー' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('oripa_cards').insert({
    pack_id: packId,
    ...parsed.data,
    image_url: parsed.data.image_url || null,
    // 新規追加分は全部残っている状態から始まる
    remaining: parsed.data.stock,
    sort_order: { S: 50, A: 40, B: 30, C: 20, D: 10 }[parsed.data.rarity],
  })

  if (error) {
    console.error('addCard failed', error)
    return { ok: false, error: 'カードの追加に失敗しました。' }
  }

  await recalcPackSlots(packId)

  revalidatePath(`/admin/packs/${packId}`)
  revalidatePath(`/packs/${packId}`)
  return { ok: true, message: 'カードを追加しました。' }
}

export async function deleteCard(
  packId: string,
  cardId: string
): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return { ok: false, error: denied }

  const admin = createAdminClient()

  // 既に誰かが引いたカードは消せない（draws から参照されている）
  const { count } = await admin
    .from('draws')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId)

  if (count) {
    return {
      ok: false,
      error: `このカードは${count}回排出済みのため削除できません。`,
    }
  }

  const { error } = await admin.from('oripa_cards').delete().eq('id', cardId)
  if (error) {
    console.error('deleteCard failed', error)
    return { ok: false, error: '削除に失敗しました。' }
  }

  await recalcPackSlots(packId)

  revalidatePath(`/admin/packs/${packId}`)
  revalidatePath(`/packs/${packId}`)
  return { ok: true, message: '削除しました。' }
}

/* ================================================================
   発送
   ================================================================ */

const ShipmentUpdateSchema = z.object({
  status: z.enum(['requested', 'preparing', 'shipped', 'cancelled']),
  tracking_number: z.string().trim().max(64).optional().default(''),
})

export async function updateShipment(
  shipmentId: string,
  form: FormData
): Promise<ActionResult> {
  const denied = await assertAdmin()
  if (denied) return { ok: false, error: denied }

  const parsed = ShipmentUpdateSchema.safeParse({
    status: form.get('status'),
    tracking_number: form.get('tracking_number') ?? '',
  })

  if (!parsed.success) {
    return { ok: false, error: '入力内容が正しくありません。' }
  }

  const admin = createAdminClient()
  const { status, tracking_number } = parsed.data

  const { error } = await admin
    .from('shipments')
    .update({
      status,
      tracking_number: tracking_number || null,
      shipped_at: status === 'shipped' ? new Date().toISOString() : null,
    })
    .eq('id', shipmentId)

  if (error) {
    console.error('updateShipment failed', error)
    return { ok: false, error: '更新に失敗しました。' }
  }

  // 発送済みにしたら、紐づくカードの状態も揃える
  if (status === 'shipped') {
    await admin
      .from('draws')
      .update({ status: 'shipped' })
      .eq('shipment_id', shipmentId)
  }

  revalidatePath('/admin/shipments')
  return { ok: true, message: '更新しました。' }
}
