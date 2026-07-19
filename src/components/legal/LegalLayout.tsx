import Link from 'next/link'

import { BUSINESS } from '@/lib/legal'

export function LegalLayout({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <Link href="/" className="text-sm text-ink-dim hover:text-ink">
        ← トップへ
      </Link>

      <h1 className="mt-4 text-2xl font-black">{title}</h1>
      <p className="mt-1.5 text-xs text-ink-dim">
        最終更新日：{BUSINESS.lastUpdated}
      </p>

      {/* 公開前に必ず消すこと。テンプレのまま出さないための警告。 */}
      <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-gold">
        <strong className="font-bold">開発者向けの注意：</strong>
        この文面はテンプレートです。公開前に必ず弁護士等の確認を受け、
        自社の実態に合わせて修正してください。
      </div>

      <article className="mt-8 space-y-8 text-sm leading-relaxed text-ink-dim">
        {children}
      </article>
    </div>
  )
}

export function Section({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-ink">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
