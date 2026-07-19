import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * service_role キーを使う管理用クライアント。RLS を完全にバイパスする。
 *
 * 絶対にブラウザへ渡さないこと。'server-only' を import しているので、
 * Client Component から誤って import するとビルドが失敗する。
 *
 * 使う前に必ず requireAdmin() などで呼び出し元の権限を確認すること。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL が未設定です。.env.local を確認してください。'
    )
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
