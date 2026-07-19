'use client'

import { createBrowserClient } from '@supabase/ssr'

/** ブラウザ側から使う Supabase クライアント（anon key + RLS） */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
