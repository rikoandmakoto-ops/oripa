import type { Metadata } from 'next'
import Link from 'next/link'

import { PackForm } from '@/components/admin/PackForm'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'オリパを作成' }

export default async function NewPackPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-lg py-4">
      <Link href="/admin" className="text-sm text-ink-dim hover:text-ink">
        ← 管理画面
      </Link>
      <h1 className="mt-3 text-2xl font-black">オリパを作成</h1>
      <p className="mt-1.5 text-sm text-ink-dim">
        まず枠を作り、次の画面でカードを登録します。
      </p>

      <div className="mt-6">
        <PackForm />
      </div>
    </div>
  )
}
