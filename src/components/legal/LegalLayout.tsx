import Link from 'next/link'

import { BUSINESS, missingBusinessFields } from '@/lib/legal'

export function LegalLayout({
  title,
  lead,
  children,
}: {
  title: string
  /** 見出し直下に置くリード文。任意。 */
  lead?: React.ReactNode
  children: React.ReactNode
}) {
  const missing = missingBusinessFields()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/" className="text-sm text-ink-dim hover:text-ink">
        ← トップへ
      </Link>

      <h1 className="mt-4 text-xl font-black sm:text-2xl">{title}</h1>
      <p className="mt-1.5 text-xs text-ink-dim">
        最終更新日：
        <time dateTime={BUSINESS.lastUpdated}>{BUSINESS.lastUpdated}</time>
      </p>

      {/*
        事業者情報が未設定のあいだだけ出す警告。
        すべて設定すれば自動的に消えるので、公開前の消し忘れが起きない。
      */}
      {missing.length > 0 && (
        <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-gold">
          <strong className="font-bold">開発者向けの注意：</strong>
          事業者情報が未設定です（{missing.join('・')}）。
          <code className="mx-0.5 font-mono">src/lib/legal.ts</code>
          または環境変数（
          <code className="font-mono">NEXT_PUBLIC_COMPANY_NAME</code> 等）に
          実際の値を設定してください。未設定のまま公開すると特定商取引法第11条の
          表示義務違反となります。あわせて、公開前に弁護士等による文面の確認を
          受けてください。
        </div>
      )}

      {lead && (
        <p className="mt-6 text-sm leading-relaxed text-ink-dim">{lead}</p>
      )}

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

/** 規約本文の箇条書き。マーカー位置と行間をページ間で揃えるため共通化。 */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** 特に読み落としてほしくない条項を目立たせる。 */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed">
      {children}
    </div>
  )
}
