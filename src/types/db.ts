export type Rarity = 'S' | 'A' | 'B' | 'C' | 'D'

export type DrawStatus = 'pending' | 'converted' | 'ship_requested' | 'shipped'

export type PointTxType =
  | 'charge'
  | 'draw'
  | 'convert'
  | 'admin_adjust'
  | 'refund'
  | 'bonus'

export type ShipmentStatus = 'requested' | 'preparing' | 'shipped' | 'cancelled'

export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  points: number
  is_admin: boolean
  created_at: string
  updated_at: string
}

export type OripaPack = {
  id: string
  title: string
  description: string
  image_url: string | null
  category: string
  price_points: number
  total_slots: number
  remaining_slots: number
  max_draw_per_try: number
  is_published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type OripaCard = {
  id: string
  pack_id: string
  name: string
  image_url: string | null
  rarity: Rarity
  stock: number
  remaining: number
  point_value: number
  is_hit: boolean
  sort_order: number
  created_at: string
}

export type Draw = {
  id: string
  user_id: string
  pack_id: string
  card_id: string
  cost_points: number
  card_name: string
  card_rarity: Rarity
  card_image_url: string | null
  point_value: number
  status: DrawStatus
  shipment_id: string | null
  created_at: string
}

export type PointTransaction = {
  id: string
  user_id: string
  amount: number
  type: PointTxType
  balance_after: number
  reference_id: string | null
  description: string
  created_at: string
}

export type Shipment = {
  id: string
  user_id: string
  status: ShipmentStatus
  recipient_name: string
  postal_code: string
  address: string
  phone: string
  note: string
  tracking_number: string | null
  created_at: string
  shipped_at: string | null
}

/** draw_oripa RPC が返す1枚分のカード */
export type DrawnCard = {
  draw_id: string
  card_id: string
  name: string
  rarity: Rarity
  image_url: string | null
  point_value: number
  is_hit: boolean
}

export type DrawResult = {
  cards: DrawnCard[]
  balance: number
  spent: number
}

/* ================================================================
   決済 (Stripe)
   ================================================================ */

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired'

export type Payment = {
  id: string
  user_id: string
  /** src/lib/points-plans.ts のプラン ID */
  plan_id: string
  /** 請求額(円) */
  amount_yen: number
  points: number
  bonus_points: number
  status: PaymentStatus
  stripe_session_id: string | null
  stripe_payment_intent_id: string | null
  /** 実際に付与したポイント。付与前は 0 */
  credited_points: number
  failure_reason: string
  created_at: string
  updated_at: string
  paid_at: string | null
}
