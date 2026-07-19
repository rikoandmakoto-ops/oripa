'use client'

import { useState } from 'react'

import { prime } from '@/lib/sfx'
import type { DrawnCard, Rarity } from '@/types/db'

import { GachaOverlay } from './GachaOverlay'

const SAMPLE: Record<Rarity, Omit<DrawnCard, 'draw_id' | 'card_id'>> = {
  S: {
    name: 'リザードンex SAR',
    rarity: 'S',
    image_url: null,
    point_value: 80000,
    is_hit: true,
  },
  A: {
    name: 'ナンジャモ SAR',
    rarity: 'A',
    image_url: null,
    point_value: 25000,
    is_hit: true,
  },
  B: {
    name: 'ミュウツーex SR',
    rarity: 'B',
    image_url: null,
    point_value: 5000,
    is_hit: false,
  },
  C: {
    name: '汎用SR 1枚',
    rarity: 'C',
    image_url: null,
    point_value: 1200,
    is_hit: false,
  },
  D: {
    name: 'ノーマルカード 1枚',
    rarity: 'D',
    image_url: null,
    point_value: 300,
    is_hit: false,
  },
}

function make(rarities: Rarity[]): DrawnCard[] {
  return rarities.map((r, i) => ({
    ...SAMPLE[r],
    draw_id: `preview-${i}-${r}`,
    card_id: `card-${r}`,
  }))
}

const SCENARIOS: { label: string; hint: string; rarities: Rarity[] }[] = [
  { label: '単発 / ハズレ', hint: 'D — 演出は最小', rarities: ['D'] },
  { label: '単発 / レア', hint: 'B — 紫の予告', rarities: ['B'] },
  { label: '単発 / 激アツ', hint: 'A — 金の予告＋紙吹雪', rarities: ['A'] },
  {
    label: '単発 / 神引き',
    hint: 'S — 全部乗せ＋ファンファーレ',
    rarities: ['S'],
  },
  {
    label: '10連 / 平常',
    hint: '最高 C',
    rarities: ['D', 'D', 'C', 'D', 'D', 'C', 'D', 'D', 'D', 'C'],
  },
  {
    label: '10連 / SSR入り',
    hint: '最高 S — 予告から本気',
    rarities: ['D', 'C', 'D', 'B', 'D', 'C', 'A', 'D', 'D', 'S'],
  },
]

export function GachaPreview() {
  const [cards, setCards] = useState<DrawnCard[] | null>(null)

  return (
    <div className="py-6">
      <h1 className="text-2xl font-black">ガチャ演出プレビュー</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">
        ポイントを消費せずに演出だけを確認できます。開発時のみ表示され、本番ビルドでは 404 になります。
        <br />
        効果音は WebAudio で合成しているため、音声ファイルはありません。
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              prime()
              setCards(make(s.rarities))
            }}
            className="rounded-xl border border-line bg-surface/60 px-4 py-3.5 text-left transition hover:border-brand"
          >
            <span className="block font-bold">{s.label}</span>
            <span className="mt-0.5 block text-xs text-ink-dim">{s.hint}</span>
          </button>
        ))}
      </div>

      {cards && (
        <GachaOverlay
          cards={cards}
          packTitle="プレビュー用オリパ"
          onClose={() => setCards(null)}
        />
      )}
    </div>
  )
}
