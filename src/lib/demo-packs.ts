import type { DrawnCard, Rarity } from '@/types/db'

/**
 * /demo 専用のモックデータ。DB もログインも不要で、抽選は全てブラウザ内で完結する。
 * 本番の抽選ロジック（在庫消化型）とは別物なので、確率は演出を体験させるための重み付け。
 */

export type DemoCard = {
  name: string
  rarity: Rarity
  point_value: number
  is_hit: boolean
  /** 抽選の重み。同一パック内の合計に対する比率で当たる */
  weight: number
}

export type DemoPack = {
  id: string
  title: string
  catch: string
  category: string
  price_points: number
  /** カードのグラデーション（Tailwind の from/to クラス） */
  accent: string
  cards: DemoCard[]
}

export const DEMO_PACKS: DemoPack[] = [
  {
    id: 'demo-pokemon',
    title: 'ポケモンカード 高額オリパ',
    catch: 'SAR・SR確率高め。1口1,000ptの定番オリパ',
    category: 'pokemon',
    price_points: 1000,
    accent: 'from-brand to-brand-2',
    cards: [
      { name: 'リザードンex SAR', rarity: 'S', point_value: 80000, is_hit: true, weight: 1 },
      { name: 'ミライドンex SAR', rarity: 'S', point_value: 60000, is_hit: true, weight: 1 },
      { name: 'ナンジャモ SAR', rarity: 'A', point_value: 25000, is_hit: true, weight: 6 },
      { name: 'ボタン SAR', rarity: 'A', point_value: 18000, is_hit: true, weight: 6 },
      { name: 'ミュウツーex SR', rarity: 'B', point_value: 5000, is_hit: false, weight: 24 },
      { name: 'ピカチュウex RR', rarity: 'B', point_value: 3800, is_hit: false, weight: 24 },
      { name: '汎用サポート SR', rarity: 'C', point_value: 1200, is_hit: false, weight: 90 },
      { name: 'エネルギー加速 UR', rarity: 'C', point_value: 900, is_hit: false, weight: 90 },
      { name: 'ノーマルカード 3枚セット', rarity: 'D', point_value: 300, is_hit: false, weight: 380 },
      { name: 'コモン 5枚セット', rarity: 'D', point_value: 200, is_hit: false, weight: 380 },
    ],
  },
  {
    id: 'demo-yugioh',
    title: '遊戯王 レアコレ オリパ',
    catch: '1口500ptで気軽に。ハズレなしのお試し向け',
    category: 'yugioh',
    price_points: 500,
    accent: 'from-accent to-brand-2',
    cards: [
      { name: '青眼の白龍 20thシークレット', rarity: 'S', point_value: 120000, is_hit: true, weight: 1 },
      { name: 'ブラック・マジシャン プリシク', rarity: 'A', point_value: 22000, is_hit: true, weight: 8 },
      { name: '灰流うらら 25thシク', rarity: 'A', point_value: 15000, is_hit: true, weight: 8 },
      { name: '増殖するG ウルトラレア', rarity: 'B', point_value: 4200, is_hit: false, weight: 30 },
      { name: '無限泡影 スーパー', rarity: 'B', point_value: 2600, is_hit: false, weight: 30 },
      { name: '汎用罠カード スーパー', rarity: 'C', point_value: 800, is_hit: false, weight: 120 },
      { name: 'テーマデッキパーツ 3枚', rarity: 'C', point_value: 600, is_hit: false, weight: 120 },
      { name: 'ノーマル 10枚セット', rarity: 'D', point_value: 150, is_hit: false, weight: 500 },
    ],
  },
  {
    id: 'demo-onepiece',
    title: 'ワンピースカード 神引きオリパ',
    catch: '1口3,000pt。SSR確率3倍のハイリスク・ハイリターン',
    category: 'onepiece',
    price_points: 3000,
    accent: 'from-gold to-brand',
    cards: [
      { name: 'シャンクス パラレル', rarity: 'S', point_value: 150000, is_hit: true, weight: 6 },
      { name: 'ヤマト コミパラ', rarity: 'S', point_value: 90000, is_hit: true, weight: 6 },
      { name: 'ボア・ハンコック SR', rarity: 'A', point_value: 34000, is_hit: true, weight: 20 },
      { name: 'ゾロ&サンジ SR', rarity: 'A', point_value: 28000, is_hit: true, weight: 20 },
      { name: 'ルフィ リーダーパラレル', rarity: 'B', point_value: 9000, is_hit: false, weight: 60 },
      { name: 'ナミ R', rarity: 'B', point_value: 6000, is_hit: false, weight: 60 },
      { name: '汎用イベント UC', rarity: 'C', point_value: 2000, is_hit: false, weight: 130 },
      { name: 'キャラカード 5枚', rarity: 'D', point_value: 800, is_hit: false, weight: 200 },
    ],
  },
]

/** レアリティごとの排出確率（％）。パック詳細の確率表に使う */
export function demoOdds(pack: DemoPack): { rarity: Rarity; percent: number }[] {
  const total = pack.cards.reduce((s, c) => s + c.weight, 0)
  const byRarity = new Map<Rarity, number>()
  for (const c of pack.cards) {
    byRarity.set(c.rarity, (byRarity.get(c.rarity) ?? 0) + c.weight)
  }
  return (['S', 'A', 'B', 'C', 'D'] as Rarity[])
    .filter((r) => byRarity.has(r))
    .map((r) => ({ rarity: r, percent: ((byRarity.get(r) ?? 0) / total) * 100 }))
}

function pickOne(pack: DemoPack): DemoCard {
  const total = pack.cards.reduce((s, c) => s + c.weight, 0)
  let roll = Math.random() * total
  for (const c of pack.cards) {
    roll -= c.weight
    if (roll <= 0) return c
  }
  return pack.cards[pack.cards.length - 1]
}

/** クライアント内で完結する抽選。draw_id は GachaOverlay の key に使われるので必ず一意にする */
export function demoDraw(pack: DemoPack, count: number, seq: number): DrawnCard[] {
  return Array.from({ length: count }, (_, i) => {
    const c = pickOne(pack)
    return {
      draw_id: `${pack.id}-${seq}-${i}`,
      card_id: `${pack.id}-${c.rarity}-${c.name}`,
      name: c.name,
      rarity: c.rarity,
      image_url: null,
      point_value: c.point_value,
      is_hit: c.is_hit,
    }
  })
}
