import type {
  CardSource,
  ProcurementStatus,
  ShopCode,
  SourceStockStatus,
} from '@/types/db'

/**
 * 仮在庫モデルの共通ロジック。
 *
 * ポイントと円のレートはこの1箇所でだけ決める。今は 1pt = 1円。
 * 変えるときはここを直せば利益率の表示すべてに効く。
 */
export const YEN_PER_POINT = 1

export function pointsToYen(points: number): number {
  return Math.round(points * YEN_PER_POINT)
}

/* ================================================================
   ショップ
   ================================================================ */

export type ShopMeta = {
  label: string
  /** Phase 2 の自動巡回に対応する予定か。今はすべて手動更新。 */
  auto: 'api' | 'scrape' | 'manual'
  hint: string
}

export const SHOPS: Record<ShopCode, ShopMeta> = {
  manual: {
    label: 'その他（手動）',
    auto: 'manual',
    hint: 'URLと価格を手で入力・更新します。',
  },
  yuyutei: {
    label: '遊々亭',
    auto: 'scrape',
    hint: 'Phase 2 でHTML巡回に対応予定。今は手動更新。',
  },
  cardrush: {
    label: 'カードラッシュ',
    auto: 'scrape',
    hint: 'Phase 2 でHTML巡回に対応予定。今は手動更新。',
  },
  toretoku: {
    label: 'トレトク',
    auto: 'scrape',
    hint: 'Phase 2 でHTML巡回に対応予定。今は手動更新。',
  },
  yahoo: {
    label: 'Yahoo!ショッピング',
    auto: 'api',
    hint: 'Phase 2 で商品検索APIに対応予定。今は手動更新。',
  },
}

export const SHOP_ORDER: ShopCode[] = [
  'yuyutei',
  'cardrush',
  'toretoku',
  'yahoo',
  'manual',
]

export function shopLabel(code: string): string {
  return SHOPS[code as ShopCode]?.label ?? code
}

/* ================================================================
   ステータス表示
   ================================================================ */

export const STOCK_STATUS: Record<
  SourceStockStatus,
  { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }
> = {
  in_stock: { label: '在庫あり', tone: 'ok' },
  low_stock: { label: '残りわずか', tone: 'warn' },
  out_of_stock: { label: '在庫切れ', tone: 'bad' },
  unknown: { label: '未確認', tone: 'mute' },
}

export const PROCUREMENT_STATUS: Record<
  ProcurementStatus,
  { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }
> = {
  pending: { label: '未調達', tone: 'warn' },
  ordered: { label: '調達済', tone: 'mute' },
  shipped: { label: '発送済', tone: 'mute' },
  completed: { label: '完了', tone: 'ok' },
  failed: { label: '失敗（返還済）', tone: 'bad' },
}

export const PROCUREMENT_STATUS_ORDER: ProcurementStatus[] = [
  'pending',
  'ordered',
  'shipped',
  'completed',
  'failed',
]

/** 一覧のフィルタ。'all' は全件。 */
export type ProcurementFilter = ProcurementStatus | 'all' | 'open'

export const PROCUREMENT_FILTERS: { value: ProcurementFilter; label: string }[] =
  [
    { value: 'open', label: '未完了' },
    { value: 'pending', label: '未調達' },
    { value: 'ordered', label: '調達済' },
    { value: 'shipped', label: '発送済' },
    { value: 'completed', label: '完了' },
    { value: 'failed', label: '失敗' },
    { value: 'all', label: 'すべて' },
  ]

/** フィルタ値 -> 実際に絞り込むステータス配列。null なら絞り込まない。 */
export function filterToStatuses(f: ProcurementFilter): ProcurementStatus[] | null {
  if (f === 'all') return null
  if (f === 'open') return ['pending', 'ordered', 'shipped']
  return [f]
}

export function isProcurementFilter(v: string | undefined): v is ProcurementFilter {
  return PROCUREMENT_FILTERS.some((f) => f.value === v)
}

/* ================================================================
   仕入れ先の選択と利益率
   ================================================================ */

/**
 * 実際に買いに行くべき仕入れ先。
 * 有効で在庫切れでないものを 優先度 -> 価格 の順に並べた先頭。
 */
export function bestSource(sources: CardSource[]): CardSource | null {
  const usable = sources
    .filter((s) => s.is_active && s.stock_status !== 'out_of_stock')
    .sort((a, b) => a.priority - b.priority || a.price - b.price)

  return usable[0] ?? null
}

/** 仕入れ先が1つも無い / 全滅しているカードは調達事故のもとなので警告に使う */
export function hasUsableSource(sources: CardSource[]): boolean {
  return bestSource(sources) !== null
}

export type Margin = {
  /** 想定売上（円） */
  revenue: number
  /** 想定原価（円） */
  cost: number
  profit: number
  /** 0.32 = 32%。売上が0なら null。 */
  rate: number | null
}

export function margin(revenueYen: number, costYen: number): Margin {
  const profit = revenueYen - costYen
  return {
    revenue: revenueYen,
    cost: costYen,
    profit,
    rate: revenueYen > 0 ? profit / revenueYen : null,
  }
}

/**
 * パック全体の想定利益。
 *
 *   売上 = 1口の価格 × 総口数
 *   原価 = Σ（カードの封入数 × そのカードの最安仕入れ値）
 *
 * 仕入れ先が未登録のカードは原価0として扱われるので、
 * 「未登録が何枚あるか」も一緒に返して画面で警告できるようにしている。
 */
export function packMargin(
  pricePoints: number,
  totalSlots: number,
  cards: { id: string; stock: number }[],
  sourcesByCard: Map<string, CardSource[]>
): Margin & { unsourcedCards: number } {
  let cost = 0
  let unsourced = 0

  for (const card of cards) {
    const best = bestSource(sourcesByCard.get(card.id) ?? [])
    if (!best) {
      unsourced += 1
      continue
    }
    cost += best.price * card.stock
  }

  return {
    ...margin(pointsToYen(pricePoints) * totalSlots, cost),
    unsourcedCards: unsourced,
  }
}

/** これ以上チェックしていない仕入れ先は「要確認」として扱う */
export const STALE_MS = 24 * 60 * 60 * 1000

/**
 * 最終確認からの経過で「価格が古い」かを判定する。
 *
 * 現在時刻を引数で受け取らず中で読むのは、呼び出し側の Server Component を
 * 純粋なままにしておくため（React の purity ルールに引っかからない）。
 * リクエスト時刻に依存するので、必ず connection() を挟んだ後に呼ぶこと。
 */
export function isStale(lastCheckedAt: string): boolean {
  return Date.now() - new Date(lastCheckedAt).getTime() > STALE_MS
}

export function fmtYen(n: number | null | undefined): string {
  return `¥${(n ?? 0).toLocaleString('ja-JP')}`
}

export function fmtRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}
