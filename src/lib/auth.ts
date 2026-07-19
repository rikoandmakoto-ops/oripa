import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/db'

/** ログイン中ならプロフィールを返す。未ログインなら null。 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data as Profile) ?? null
}

/** ログイン必須のページで使う。未ログインならログイン画面へ飛ばす。 */
export async function requireProfile(redirectTo = '/'): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`)
  }
  return profile
}

/** 管理者必須のページ・APIで使う。 */
export async function requireAdmin(redirectTo = '/admin'): Promise<Profile> {
  const profile = await requireProfile(redirectTo)
  if (!profile.is_admin) {
    redirect('/')
  }
  return profile
}
