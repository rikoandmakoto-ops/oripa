'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { CATEGORY_LABELS } from '@/lib/format'
import type { OripaPack } from '@/types/db'

import { createPack, updatePack } from '@/app/admin/actions'

export function PackForm({ pack }: { pack?: OripaPack }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  function onSubmit(form: FormData) {
    startTransition(async () => {
      const res = pack
        ? await updatePack(pack.id, form)
        : await createPack(form)

      if (res.ok) {
        setFeedback({ ok: true, text: res.message })
        if (!pack && res.id) {
          router.push(`/admin/packs/${res.id}`)
        } else {
          router.refresh()
        }
      } else {
        setFeedback({ ok: false, text: res.error })
      }
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {feedback && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.ok
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-rarity-s/40 bg-rarity-s/10 text-rarity-s'
          }`}
        >
          {feedback.text}
        </p>
      )}

      <Field
        name="title"
        label="タイトル"
        defaultValue={pack?.title}
        required
        maxLength={120}
      />

      <div>
        <label htmlFor="description" className="mb-1 block text-xs text-ink-dim">
          説明
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={pack?.description}
          className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-sm outline-none transition focus:border-brand"
        />
      </div>

      <div>
        <label htmlFor="category" className="mb-1 block text-xs text-ink-dim">
          カードゲーム
        </label>
        <select
          id="category"
          name="category"
          defaultValue={pack?.category ?? 'pokemon'}
          className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-sm outline-none transition focus:border-brand"
        >
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Field
        name="image_url"
        label="バナー画像URL（任意）"
        type="url"
        placeholder="https://…"
        defaultValue={pack?.image_url ?? ''}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          name="price_points"
          label="1口あたりの価格（pt）"
          type="number"
          min={1}
          defaultValue={pack?.price_points ?? 1000}
          required
        />
        <Field
          name="max_draw_per_try"
          label="一度に引ける上限"
          type="number"
          min={1}
          max={100}
          defaultValue={pack?.max_draw_per_try ?? 10}
          required
        />
      </div>

      {pack && (
        <label className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3.5">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={pack.is_published}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
          <span className="text-sm">
            <span className="font-bold">公開する</span>
            <span className="mt-0.5 block text-xs text-ink-dim">
              公開するとトップページに並び、誰でも引けるようになります。
            </span>
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-linear-to-r from-brand to-brand-2 py-3.5 font-black text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? '保存中…' : pack ? '保存する' : '作成する'}
      </button>

      {!pack && (
        <p className="text-center text-xs text-ink-dim">
          作成後にカードを登録すると、口数が自動で計算されます。
        </p>
      )}
    </form>
  )
}

function Field({
  name,
  label,
  ...rest
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs text-ink-dim">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-sm outline-none transition placeholder:text-ink-dim/50 focus:border-brand"
        {...rest}
      />
    </div>
  )
}
