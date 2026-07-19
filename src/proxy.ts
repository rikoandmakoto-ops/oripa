import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase のセッション Cookie を毎リクエストで更新する。
 * これが無いとアクセストークンが切れたときに勝手にログアウトされる。
 *
 * Next.js 16 で middleware.ts は proxy.ts にリネームされた（ランタイムは nodejs 固定）。
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() を呼ぶことでトークンのリフレッシュが走る
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * 静的アセットと画像最適化を除く全パス。
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
