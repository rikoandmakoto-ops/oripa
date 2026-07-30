import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { findPlan, planLabel } from '@/lib/points-plans'
import { getStripe, isStripeConfigured, resolveSiteUrl } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * ポイントチャージの Checkout Session を作る。
 *
 * 金額はプラン ID からサーバ側で引き直す。クライアントが送ってくる
 * 金額やポイント数は一切使わない。
 *
 * ポイントの付与はここでは行わない。入金が確定するのは Stripe の
 * Webhook (/api/stripe/webhook) だけで、そこから payments 行を見て
 * 付与する。Checkout の成功 URL に戻ってきたことは入金の証明にならない。
 */
const BodySchema = z.object({
  plan_id: z.string().min(1).max(64),
})

/** Checkout の有効期限(秒)。放置された pending を溜めすぎない。 */
const CHECKOUT_TTL_SEC = 30 * 60

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: '決済は現在準備中です。' },
      { status: 503 }
    )
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'リクエストが不正です。' }, { status: 400 })
  }

  const plan = findPlan(parsed.data.plan_id)
  if (!plan) {
    return NextResponse.json(
      { error: 'このプランは選択できません。' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 先に決済記録を作る。Webhook はこの行に焼かれた金額だけを見るので、
  // 後から Stripe 側の値をそのまま信じる必要がなくなる。
  const { data: payment, error: insertError } = await admin
    .from('payments')
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      amount_yen: plan.yen,
      points: plan.points,
      bonus_points: plan.bonus,
    })
    .select('id')
    .single()

  if (insertError || !payment) {
    console.error('payment insert failed', insertError)
    return NextResponse.json(
      { error: '決済を開始できませんでした。' },
      { status: 500 }
    )
  }

  const site = resolveSiteUrl(request.url)

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'ja',
      submit_type: 'pay',
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SEC,
      line_items: [
        {
          quantity: 1,
          price_data: {
            // JPY は最小単位が円そのもの。100倍しないこと。
            currency: 'jpy',
            unit_amount: plan.yen,
            product_data: {
              name: `ORIPA ポイント ${planLabel(plan)}`,
              description:
                'オリパ抽選に使えるサイト内ポイントです。現金への払い戻しはできません。',
            },
          },
        },
      ],
      // Webhook はまず payment_id を見て決済記録を引く
      metadata: {
        payment_id: payment.id,
        user_id: user.id,
        plan_id: plan.id,
      },
      payment_intent_data: {
        metadata: {
          payment_id: payment.id,
          user_id: user.id,
          plan_id: plan.id,
        },
      },
      success_url: `${site}/points/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/points?canceled=1`,
    })

    if (!session.url) {
      throw new Error('checkout session has no url')
    }

    // セッション ID を控える。Webhook はこれで決済記録を引く。
    const { error: updateError } = await admin
      .from('payments')
      .update({ stripe_session_id: session.id })
      .eq('id', payment.id)

    if (updateError) {
      // ここで失敗すると入金しても付与できないので、決済させずに止める。
      console.error('payment session id update failed', updateError)
      await getStripe().checkout.sessions.expire(session.id)
      await admin
        .from('payments')
        .update({ status: 'failed', failure_reason: 'session id 保存に失敗' })
        .eq('id', payment.id)

      return NextResponse.json(
        { error: '決済を開始できませんでした。' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('checkout session create failed', error)
    await admin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: 'Checkout Session の作成に失敗',
      })
      .eq('id', payment.id)

    return NextResponse.json(
      { error: '決済を開始できませんでした。時間をおいてお試しください。' },
      { status: 502 }
    )
  }
}
