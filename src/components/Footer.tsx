import Link from 'next/link'

const LEGAL_LINKS = [
  { href: '/legal/tokushoho', label: '特定商取引法に基づく表示' },
  { href: '/legal/terms', label: '利用規約' },
  { href: '/legal/privacy', label: 'プライバシーポリシー' },
]

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-ink-dim transition hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 space-y-1 text-xs leading-relaxed text-ink-dim">
          <p>
            古物商許可番号：
            <span className="text-ink">
              {process.env.NEXT_PUBLIC_ANTIQUE_LICENSE_NO || '（未設定）'}
            </span>
          </p>
          <p>
            本サービスは18歳未満の方はご利用いただけません。獲得したカードの現金への換金は一切行っておりません。
          </p>
          <p className="pt-2">© {new Date().getFullYear()} ORIPA</p>
        </div>
      </div>
    </footer>
  )
}
