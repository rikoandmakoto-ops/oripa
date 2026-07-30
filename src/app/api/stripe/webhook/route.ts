import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'

import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Stripe Webhook。ポイントが実際に増えるのはここだけ。
 *
 * 設計上の前提:
 *   - 署名検証を通らないリクエストは一切処理しない
 *   - 同じイベントが複数回届く。付与の冪等性は
 *     fulfill_stripe_payment() 側(payments 行のロック)で担保する
 *   - 恒久的な異常(金額不一致など)は 200 を返して再送を止め、
 *     一時的な異常(DB エラー等)は 500 を返して Stripe に再送させる
 *
 * 生のリクエストボディが必要なので、絶対に request.json() を使わないこと。
 * パース済みの JSON では署名検証に通らない。
 */

/** 署名検証済みイベントのうち、ここで処理するもの */
const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
])

/** 再送しても結果が変わらない = Stripe に再送させても無駄なエラー */
const PERMANENT_ERRORS = ['AMOUNT_MISMATCH', 'PAYMENT_NOT_PENDING', 'INVALID_SESSION']

/**
 * Supabase が返すエラーは Error のインスタンスではなく
 * { message, details, hint, code } のただのオブジェクト。
 * RPC が raise した例外名は message か details に入るので、
 * どちらも見える形の文字列に均す。
 */
function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    const parts = [e.message, e.details, e.hint, e.code].filter(
      (v): v is string => typeof v === 'string' && v.length > 0
    )
    if (parts.length > 0) return parts.join(' | ')
  }
  return String(error)
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent
  if (!pi) return null
  return typeof pi === 'string' ? pi : pi.id
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!isStripeConfigured() || !secret) {
    console.error('stripe webhook called but STRIPE keys are not configured')
    return new NextResponse('Not Found', { status: 404 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  }

  // 署名検証には生のボディが必要
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = await getStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      secret
    )
  } catch (error) {
    // 署名が合わない = Stripe 以外からのリクエスト。中身は見ない。
    console.error('stripe signature verification failed', error)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        // コンビニ払い等では completed の時点ではまだ入金されていない。
        // その場合は何もせず、後から届く async_payment_succeeded を待つ。
        if (session.payment_status !== 'paid') {
          return NextResponse.json({
            received: true,
            pending: session.payment_status,
          })
        }

        const { data, error } = await admin.rpc('fulfill_stripe_payment', {
          p_session_id: session.id,
          p_payment_intent_id: paymentIntentId(session),
          p_amount_yen: session.amount_total ?? null,
        })

        if (error) throw error

        const result = data as { already_credited: boolean; credited: number }
        if (!result.already_credited) {
          console.log('points credited', {
            event: event.id,
            session: session.id,
            credited: result.credited,
          })
        }

        return NextResponse.json({ received: true, ...result })
      }

      case 'checkout.session.async_payment_failed': {
        const { error } = await admin.rpc('fail_stripe_payment', {
          p_session_id: session.id,
          p_status: 'failed',
          p_reason: '入金が確認できませんでした',
        })
        if (error) throw error
        return NextResponse.json({ received: true })
      }

      case 'checkout.session.expired': {
        const { error } = await admin.rpc('fail_stripe_payment', {
          p_session_id: session.id,
          p_status: 'expired',
          p_reason: '有効期限切れ',
        })
        if (error) throw error
        return NextResponse.json({ received: true })
      }

      default:
        return NextResponse.json({ received: true, ignored: event.type })
    }
  } catch (error) {
    const message = errorText(error)

    // 再送しても直らない異常。200 を返して再送を止め、ログで気付けるようにする。
    if (PERMANENT_ERRORS.some((code) => message.includes(code))) {
      console.error('stripe webhook permanent failure', {
        event: event.id,
        type: event.type,
        session: session.id,
        message,
      })
      return NextResponse.json({ received: true, error: 'unprocessable' })
    }

    // PAYMENT_NOT_FOUND を含む一時的な可能性のある失敗は再送させる。
    // (Checkout 作成直後の書き込みと入れ違う可能性があるため)
    console.error('stripe webhook failed', {
      event: event.id,
      type: event.type,
      session: session.id,
      message,
    })
    return NextResponse.json({ error: 'retry' }, { status: 500 })
  }
}
