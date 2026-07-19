import Link from 'next/link'

import { getProfile } from '@/lib/auth'
import { fmtNum } from '@/lib/format'

import { SignOutButton } from './SignOutButton'

export async function Header() {
  const profile = await getProfile()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="mr-auto flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-brand to-brand-2 text-sm font-black">
            O
          </span>
          <span className="text-lg font-black tracking-tight">ORIPA</span>
        </Link>

        {profile ? (
          <>
            <Link
              href="/points"
              className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-bold text-gold transition hover:bg-gold/20"
            >
              <span aria-hidden>◈</span>
              <span>{fmtNum(profile.points)}</span>
              <span className="text-xs font-medium opacity-70">pt</span>
            </Link>

            <Link
              href="/mypage"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-dim transition hover:text-ink"
            >
              マイページ
            </Link>

            {profile.is_admin && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition hover:brightness-125"
              >
                管理
              </Link>
            )}

            <SignOutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-linear-to-r from-brand to-brand-2 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
          >
            ログイン
          </Link>
        )}
      </div>
    </header>
  )
}
