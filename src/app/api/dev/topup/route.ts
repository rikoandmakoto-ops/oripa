import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * 開発用のポイント付与。Stripe 連携（Phase 2）までの動作確認用。
 *
 * 二重に鍵をかけている:
 *   1. ENABLE_DEV_TOPUP=true が明示的に設定されていること
 *   2. 本番ビルドでないこと
 * 片方でも欠けたら 404 を返す。
 */
export function isDevTopupEnabled() {
  return (
    process.env.ENABLE_DEV_TOPUP === 'true' &&
    process.env.NODE_ENV !== 'production'
  )
}

const BodySchema = z.object({
  amount: z.number().int().min(100).max(100000),
})

export async function POST(request: NextRequest) {
  if (!isDevTopupEnabled()) {
    // 有効化されていないことを悟らせない
    return new NextResponse('Not Found', { status: 404 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '金額が不正です。' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  }

  // credit_points は service_role からしか実行できない
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('credit_points', {
    p_user_id: user.id,
    p_amount: parsed.data.amount,
    p_type: 'charge',
    p_description: '開発用チャージ',
  })

  if (error) {
    console.error('dev topup failed', error)
    return NextResponse.json({ error: 'チャージに失敗しました。' }, { status: 500 })
  }

  return NextResponse.json(data)
}
