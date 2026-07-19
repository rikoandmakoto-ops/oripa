import type { Rarity } from '@/types/db'

export const RARITY_ORDER: Rarity[] = ['S', 'A', 'B', 'C', 'D']

type RarityStyle = {
  label: string
  /** カード枠・文字色 */
  color: string
  /** 背景グラデーション */
  gradient: string
  /** 発光色（rgba） */
  glow: string
  /** 演出の格。数字が大きいほど派手 */
  tier: number
  /** 確定演出のキャッチコピー */
  hype: string
}

export const RARITY: Record<Rarity, RarityStyle> = {
  S: {
    label: 'SSR',
    color: '#ff3d6e',
    gradient: 'linear-gradient(135deg,#ff3d6e,#ffc93c,#ff3d6e)',
    glow: 'rgba(255,61,110,.85)',
    tier: 4,
    hype: '神引き',
  },
  A: {
    label: 'SR',
    color: '#ffb020',
    gradient: 'linear-gradient(135deg,#ffb020,#fff3a0,#ffb020)',
    glow: 'rgba(255,176,32,.8)',
    tier: 3,
    hype: '激アツ',
  },
  B: {
    label: 'R',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg,#a855f7,#e9d5ff,#a855f7)',
    glow: 'rgba(168,85,247,.75)',
    tier: 2,
    hype: 'チャンス',
  },
  C: {
    label: 'UC',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg,#38bdf8,#bae6fd,#38bdf8)',
    glow: 'rgba(56,189,248,.6)',
    tier: 1,
    hype: '',
  },
  D: {
    label: 'N',
    color: '#64748b',
    gradient: 'linear-gradient(135deg,#475569,#94a3b8,#475569)',
    glow: 'rgba(100,116,139,.5)',
    tier: 0,
    hype: '',
  },
}

export function rarityOf(r: string): RarityStyle {
  return RARITY[(r as Rarity) in RARITY ? (r as Rarity) : 'D']
}

/** 複数枚のうち一番格の高いレアリティを返す（10連の演出強度を決めるのに使う） */
export function topRarity(rarities: string[]): Rarity {
  let best: Rarity = 'D'
  for (const r of rarities) {
    const key = (r as Rarity) in RARITY ? (r as Rarity) : 'D'
    if (RARITY[key].tier > RARITY[best].tier) best = key
  }
  return best
}
