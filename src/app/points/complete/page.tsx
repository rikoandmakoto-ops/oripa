import type { Metadata } from 'next'
import Link from 'next/link'

import { PaymentPoller } from '@/components/points/PaymentPoller'
import { requireProfile } from '@/lib/auth'
import { fmtNum } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { Payment } from '@/types/db'

export const metadata: Metadata = { title: '決済完了' }
export const dynamic = 'force-dynamic'

/**
 * Stripe の決済ページから戻ってくる先。
 *
 * ここに来たこと自体は入金の証明にならない(URL を直接開けば誰でも来られる)。
 * 実際の残高は Webhook が payments を paid にしたかどうかで判断する。
 */
export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const profile = await requireProfile('/points')

  const raw = (await searchParams).session_id
  const sessionId = typeof raw === 'string' ? raw : null

  const supabase = await createClient()

  // RLS により、自分の決済記録しか引けない
  const { data } = sessionId
    ? await supabase
        .from('payments')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .maybeSingle()
    : { data: null }

  const payment = (data as Payment | null) ?? null

  return (
    <div className="py-10">
      <div className="rounded-2xl border border-line bg-surface/60 px-5 py-8 text-center">
        {payment?.status === 'paid' ? (
          <>
            <p className="text-3xl">🎉</p>
            <h1 className="mt-3 text-xl font-black">チャージが完了しました</h1>
            <p className="mt-4 text-3xl font-black text-gold">
              +{fmtNum(payment.credited_points)}
              <span className="ml-1 text-base">pt</span>
            </p>
            <p className="mt-2 text-sm text-ink-dim">
              現在の所持ポイント {fmtNum(profile.points)}pt
            </p>
          </>
        ) : !payment || payment.status === 'pending' ? (
          <>
            <p className="text-3xl">⏳</p>
            <h1 className="mt-3 text-xl font-black">入金を確認しています</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">
              決済は受け付けました。ポイントの反映まで少し時間がかかる場合があります。
              <br />
              このページを開いたままお待ちください。
            </p>
            <PaymentPoller />
          </>
        ) : (
          <>
            <p className="text-3xl">⚠️</p>
            <h1 className="mt-3 text-xl font-black">
              {payment.status === 'expired'
                ? '決済の有効期限が切れました'
                : '決済を完了できませんでした'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">
              ポイントは加算されていません。お手数ですが、もう一度お試しください。
              {payment.failure_reason && (
                <>
                  <br />
                  {payment.failure_reason}
                </>
              )}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 space-y-2">
        <Link
          href="/"
          className="block rounded-xl bg-brand py-3 text-center font-bold text-white transition hover:brightness-110"
        >
          オリパを引く
        </Link>
        <Link
          href="/points/history"
          className="block text-center text-sm text-ink-dim underline hover:text-ink"
        >
          ポイント履歴を見る
        </Link>
      </div>
    </div>
  )
}
