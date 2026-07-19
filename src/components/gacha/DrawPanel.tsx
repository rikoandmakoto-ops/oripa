'use client'

import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'

import { fmtNum } from '@/lib/format'
import {
  getSoundServerSnapshot,
  isSoundEnabled,
  prime,
  setSoundEnabled,
  subscribeSound,
} from '@/lib/sfx'
import { haptics } from '@/lib/haptics'
import type { DrawResult, DrawnCard, OripaPack } from '@/types/db'

import { GachaOverlay } from './GachaOverlay'

export function DrawPanel({
  pack,
  isLoggedIn,
  balance,
}: {
  pack: OripaPack
  isLoggedIn: boolean
  balance: number
}) {
  const router = useRouter()
  const [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<DrawnCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastCount, setLastCount] = useState(1)

  const sound = useSyncExternalStore(
    subscribeSound,
    isSoundEnabled,
    getSoundServerSnapshot
  )

  // 連続で引くと props の balance が古くなるので、RPC が返した残高で追従する。
  // サーバーから新しい balance が来たら、そちらを正としてリセットする
  // （props 変更に合わせて state を直す React 公式のパターン）。
  const [points, setPoints] = useState(balance)
  const [seenBalance, setSeenBalance] = useState(balance)
  if (seenBalance !== balance) {
    setSeenBalance(balance)
    setPoints(balance)
  }

  const soldOut = pack.remaining_slots <= 0

  // 引ける口数の選択肢。残り口数と上限の小さい方まで。
  const options = [1, 5, 10].filter(
    (n) => n <= Math.min(pack.max_draw_per_try, pack.remaining_slots)
  )
  if (options.length === 0 && pack.remaining_slots > 0) options.push(1)

  async function draw(count: number) {
    if (drawing) return

    if (!isLoggedIn) {
      router.push(`/login?next=/packs/${pack.id}`)
      return
    }

    const cost = pack.price_points * count
    if (points < cost) {
      setError(
        `ポイントが不足しています（必要 ${fmtNum(cost)}pt / 所持 ${fmtNum(points)}pt）`
      )
      return
    }

    // AudioContext はユーザー操作の中でしか起こせないのでここで初期化する
    prime()
    haptics.tap()

    setError(null)
    setDrawing(true)
    setLastCount(count)

    try {
      const res = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: pack.id, count }),
      })

      const json = (await res.json()) as DrawResult | { error: string }

      if (!res.ok) {
        setError('error' in json ? json.error : '抽選に失敗しました。')
        return
      }

      setResult((json as DrawResult).cards)
      setPoints((json as DrawResult).balance)
    } catch {
      setError('通信に失敗しました。電波状況をご確認ください。')
    } finally {
      setDrawing(false)
    }
  }

  function closeOverlay() {
    setResult(null)
    // 残り口数とポイント残高を最新化する
    router.refresh()
  }

  function toggleSound() {
    const next = !sound
    setSoundEnabled(next)
    if (next) prime()
  }

  return (
    <>
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-line bg-bg/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
        {error && (
          <p className="mb-3 rounded-xl border border-rarity-s/40 bg-rarity-s/10 px-4 py-2.5 text-sm text-rarity-s">
            {error}
          </p>
        )}

        {soldOut ? (
          <div className="rounded-xl border border-line bg-surface py-4 text-center font-bold text-ink-dim">
            完売しました
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={sound ? '効果音をオフにする' : '効果音をオンにする'}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-lg transition hover:text-brand"
            >
              {sound ? '🔊' : '🔇'}
            </button>

            <div className="flex flex-1 gap-2">
              {options.map((n) => {
                const cost = pack.price_points * n
                const affordable = !isLoggedIn || points >= cost
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={drawing}
                    onClick={() => draw(n)}
                    className={`flex-1 rounded-xl py-3 text-center font-black transition disabled:opacity-60 ${
                      n === Math.max(...options)
                        ? 'bg-linear-to-r from-brand to-brand-2 text-white hover:brightness-110'
                        : 'border border-line bg-surface text-ink hover:border-brand'
                    } ${!affordable ? 'opacity-50' : ''}`}
                  >
                    <span className="block text-base">{n}回</span>
                    <span className="block text-[11px] font-medium opacity-80">
                      {fmtNum(cost)}pt
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {drawing && (
          <p className="mt-3 text-center text-sm text-ink-dim">抽選中…</p>
        )}
      </div>

      {result && (
        <GachaOverlay
          cards={result}
          packTitle={pack.title}
          onClose={closeOverlay}
          onDrawAgain={() => {
            setResult(null)
            void draw(lastCount)
          }}
        />
      )}
    </>
  )
}
