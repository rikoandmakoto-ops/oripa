'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { deletePack } from '@/app/admin/actions'

export function DeletePackButton({
  packId,
  title,
}: {
  packId: string
  title: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onDelete() {
    if (
      !window.confirm(
        `「${title}」を削除します。\nこの操作は取り消せません。よろしいですか？`
      )
    ) {
      return
    }

    startTransition(async () => {
      const res = await deletePack(packId)
      if (res.ok) {
        router.push('/admin')
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-rarity-s">{error}</p>}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-xl border border-rarity-s/50 px-4 py-2.5 text-sm font-bold text-rarity-s transition hover:bg-rarity-s/10 disabled:opacity-50"
      >
        {pending ? '削除中…' : 'このオリパを削除'}
      </button>
    </div>
  )
}
