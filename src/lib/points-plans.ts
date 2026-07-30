/**
 * 販売するポイントの組み合わせ。1pt = 1円 想定。
 *
 * 金額は必ずこの定義から引く。クライアントから送られてきた金額や
 * ポイント数は一切信用しない(プラン ID だけを受け取る)。
 */
export type PointPlan = {
  /** Stripe の metadata や payments.plan_id に入る不変の ID */
  id: string
  /** 購入で付与される基本ポイント */
  points: number
  /** 上乗せされるボーナスポイント */
  bonus: number
  /** 請求額(円)。JPY は最小単位が円なので Stripe の amount と同じ値 */
  yen: number
}

export const POINT_PLANS: readonly PointPlan[] = [
  { id: 'pt_1000', points: 1000, bonus: 0, yen: 1000 },
  { id: 'pt_3000', points: 3000, bonus: 100, yen: 3000 },
  { id: 'pt_5000', points: 5000, bonus: 300, yen: 5000 },
  { id: 'pt_10000', points: 10000, bonus: 1000, yen: 10000 },
  { id: 'pt_30000', points: 30000, bonus: 4000, yen: 30000 },
] as const

/** プラン ID から定義を引く。未知の ID なら null。 */
export function findPlan(id: string): PointPlan | null {
  return POINT_PLANS.find((p) => p.id === id) ?? null
}

/** Stripe の商品名に使う表記。明細に出るのでボーナスも含めて書く。 */
export function planLabel(plan: PointPlan): string {
  const total = plan.points + plan.bonus
  return plan.bonus > 0
    ? `${total.toLocaleString('ja-JP')}pt（${plan.points.toLocaleString('ja-JP')}pt + ボーナス ${plan.bonus.toLocaleString('ja-JP')}pt）`
    : `${total.toLocaleString('ja-JP')}pt`
}
