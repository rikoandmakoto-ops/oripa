import type { ShopCode, SourceStockStatus } from '@/types/db'

/**
 * Phase 2（仕入れ先の自動巡回）の型だけを先に置いてある。
 * 実装はまだ無い。設計は docs/procurement-phase2.md を参照。
 *
 * Phase 1 の運用（管理画面からの手動更新）はこのファイルに一切依存しない。
 */

export type SourceProbe = {
  /** 取得できなかった場合は null。既存の価格を上書きしないこと。 */
  price: number | null
  stock_status: SourceStockStatus
  fetched_at: string
}

export interface ShopAdapter {
  code: ShopCode
  kind: 'api' | 'scrape'
  /** 相手サーバへの同時接続数の上限 */
  concurrency: number
  probe(url: string): Promise<SourceProbe>
}

/**
 * 巡回に失敗したときの戻り値。
 *
 * 'out_of_stock' ではなく 'unknown' を返すのが重要。
 * 取得失敗を在庫切れとして扱うと bestSource() から外れてしまい、
 * 実際には買えるカードを「調達不可」と誤判定してしまうため。
 */
export function probeFailed(): SourceProbe {
  return {
    price: null,
    stock_status: 'unknown',
    fetched_at: new Date().toISOString(),
  }
}

/** shop_code -> Adapter。Phase 2 で埋める。 */
export const ADAPTERS: Partial<Record<ShopCode, ShopAdapter>> = {}
