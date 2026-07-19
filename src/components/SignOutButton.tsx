'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    startTransition(() => {
      router.replace('/')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="rounded-lg px-2 py-1.5 text-sm text-ink-dim transition hover:text-ink disabled:opacity-50"
    >
      ログアウト
    </button>
  )
}
