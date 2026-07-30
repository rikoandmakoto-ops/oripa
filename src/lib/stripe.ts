import 'server-only'

import Stripe from 'stripe'

/**
 * Stripe のサーバサイドクライアント。
 *
 * キーが無い状態でもビルドとページ表示は通るようにしたいので、
 * モジュール読み込み時ではなく最初に使うときに初期化する。
 * ('server-only' を import しているので、Client Component から
 *  誤って import するとビルドが失敗する)
 */
let client: Stripe | null = null

/** STRIPE_SECRET_KEY が設定されているか。UI の出し分けに使う。 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY が未設定です。Vercel の環境変数、または .env.local を確認してください。'
      )
    }
    // apiVersion は指定しない = SDK が固定しているバージョンを使う。
    // 文字列で書くと SDK 更新時に型と実挙動がずれるため。
    client = new Stripe(key, {
      appInfo: { name: 'ORIPA', url: 'https://github.com/' },
    })
  }
  return client
}

/**
 * Checkout の戻り先に使う絶対 URL を決める。
 *
 * 優先順位:
 *   1. NEXT_PUBLIC_SITE_URL（本番ドメインを固定したいとき）
 *   2. リクエストの Origin（プレビューデプロイやローカル）
 *   3. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL
 */
export function resolveSiteUrl(requestUrl?: string): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin
    } catch {
      // 続けてフォールバックを見る
    }
  }

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}
