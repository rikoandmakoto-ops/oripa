import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * メールのログインリンクから戻ってきたときのハンドラ。
 * 認可コードをセッションに交換して、元いたページへ戻す。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // オープンリダイレクト対策: 自サイト内の相対パスだけ許可する
  const safeNext = next && /^\/(?!\/)/.test(next) ? next : '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
