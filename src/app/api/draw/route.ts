import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import type { DrawResult } from '@/types/db'

const BodySchema = z.object({
  pack_id: z.string().uuid(),
  count: z.number().int().min(1).max(100),
})

/** RPC が投げる例外コードを、そのまま画面に出せる日本語にする */
const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  AUTH_REQUIRED: { status: 401, message: 'ログインが必要です。' },
  PROFILE_NOT_FOUND: { status: 401, message: 'ログインしなおしてください。' },
  PACK_NOT_FOUND: { status: 404, message: 'このオリパは見つかりませんでした。' },
  PACK_NOT_PUBLISHED: { status: 403, message: 'このオリパは現在販売していません。' },
  SOLD_OUT: { status: 409, message: '在庫が不足しています。ページを再読み込みしてください。' },
  INSUFFICIENT_POINTS: { status: 402, message: 'ポイントが不足しています。' },
  COUNT_EXCEEDS_LIMIT: { status: 400, message: '一度に引ける口数を超えています。' },
  INVALID_COUNT: { status: 400, message: '口数の指定が正しくありません。' },
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です。' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'リクエストが不正です。' }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  }

  // 抽選・在庫減算・ポイント減算はすべて RPC 内の1トランザクションで行う。
  // ここで個別に UPDATE を書くと、同時アクセスで在庫が破綻する。
  const { data, error } = await supabase.rpc('draw_oripa', {
    p_pack_id: parsed.data.pack_id,
    p_count: parsed.data.count,
  })

  if (error) {
    const known = Object.entries(ERROR_MESSAGES).find(([code]) =>
      error.message.includes(code)
    )
    if (known) {
      return NextResponse.json(
        { error: known[1].message },
        { status: known[1].status }
      )
    }
    console.error('draw_oripa failed', error)
    return NextResponse.json(
      { error: '抽選に失敗しました。時間をおいてお試しください。' },
      { status: 500 }
    )
  }

  return NextResponse.json(data as DrawResult)
}
