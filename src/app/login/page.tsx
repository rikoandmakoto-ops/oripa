import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/LoginForm'
import { getProfile } from '@/lib/auth'

export const metadata: Metadata = { title: 'ログイン' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  // すでにログイン済みなら戻す
  const profile = await getProfile()
  if (profile) redirect(next || '/')

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-16">
      <h1 className="text-center text-3xl font-black">
        <span className="text-gradient">ORIPA</span> にログイン
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-ink-dim">
        メールアドレスにログイン用リンクを送ります。
        <br />
        パスワードは必要ありません。
      </p>

      {error && (
        <p className="mt-6 rounded-xl border border-rarity-s/40 bg-rarity-s/10 px-4 py-3 text-sm text-rarity-s">
          ログインに失敗しました。リンクの有効期限が切れている可能性があります。もう一度お試しください。
        </p>
      )}

      <LoginForm next={next} />

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-dim">
        ログインすることで
        <a href="/legal/terms" className="underline hover:text-ink">
          利用規約
        </a>
        および
        <a href="/legal/privacy" className="underline hover:text-ink">
          プライバシーポリシー
        </a>
        に同意したものとみなされます。
        <br />
        18歳未満の方はご利用いただけません。
      </p>
    </div>
  )
}
