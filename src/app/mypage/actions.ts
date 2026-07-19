'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const DrawIdsSchema = z.array(z.string().uuid()).min(1).max(500)

const ShipSchema = z.object({
  recipient_name: z.string().trim().min(1, 'お名前を入力してください').max(100),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{3}-?\d{4}$/, '郵便番号は「1234567」の形式で入力してください'),
  address: z.string().trim().min(1, '住所を入力してください').max(300),
  phone: z
    .string()
    .trim()
    .regex(/^[\d-]{10,15}$/, '電話番号の形式が正しくありません'),
  note: z.string().trim().max(500).optional().default(''),
})

/** 選択したカードをポイントに交換する */
export async function convertToPoints(
  drawIds: string[]
): Promise<ActionResult> {
  const parsed = DrawIdsSchema.safeParse(drawIds)
  if (!parsed.success) {
    return { ok: false, error: 'カードを選択してください。' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('convert_draws_to_points', {
    p_draw_ids: parsed.data,
  })

  if (error) {
    if (error.message.includes('NO_ELIGIBLE_DRAWS')) {
      return { ok: false, error: '交換できるカードがありませんでした。' }
    }
    if (error.message.includes('AUTH_REQUIRED')) {
      return { ok: false, error: 'ログインしなおしてください。' }
    }
    console.error('convert_draws_to_points failed', error)
    return { ok: false, error: 'ポイント交換に失敗しました。' }
  }

  revalidatePath('/mypage')

  const gained = (data as { gained: number } | null)?.gained ?? 0
  return { ok: true, message: `${gained.toLocaleString('ja-JP')}pt を獲得しました。` }
}

/** 選択したカードの発送を申請する */
export async function requestShipment(
  drawIds: string[],
  form: unknown
): Promise<ActionResult> {
  const ids = DrawIdsSchema.safeParse(drawIds)
  if (!ids.success) {
    return { ok: false, error: 'カードを選択してください。' }
  }

  const parsed = ShipSchema.safeParse(form)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('request_shipment', {
    p_draw_ids: ids.data,
    p_recipient_name: parsed.data.recipient_name,
    p_postal_code: parsed.data.postal_code,
    p_address: parsed.data.address,
    p_phone: parsed.data.phone,
    p_note: parsed.data.note ?? '',
  })

  if (error) {
    if (error.message.includes('NO_ELIGIBLE_DRAWS')) {
      return { ok: false, error: '発送できるカードがありませんでした。' }
    }
    if (error.message.includes('INCOMPLETE_ADDRESS')) {
      return { ok: false, error: '住所の入力内容をご確認ください。' }
    }
    if (error.message.includes('AUTH_REQUIRED')) {
      return { ok: false, error: 'ログインしなおしてください。' }
    }
    console.error('request_shipment failed', error)
    return { ok: false, error: '発送申請に失敗しました。' }
  }

  revalidatePath('/mypage')
  return { ok: true, message: '発送を申請しました。準備ができ次第お送りします。' }
}
