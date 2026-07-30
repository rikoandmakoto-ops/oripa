-- =============================================================
-- ORIPA Platform :: Stripe 決済 (ポイントチャージ)
--
-- 実行順: schema.sql -> functions.sql -> 0001_virtual_inventory.sql -> このファイル
-- 何度実行しても壊れないように書いてある(冪等)。
--
-- 追加するもの:
--   payments                : Checkout Session 1件につき1行の決済記録
--   fulfill_stripe_payment(): 入金確定 → ポイント付与(何度呼んでも1回しか付かない)
--   fail_stripe_payment()   : 失敗・期限切れの記録
--
-- ポイントの実際の付与は既存の credit_points() に任せる。
-- 台帳(point_transactions)への記帳経路を1本にしておくことで、
-- profiles.points と台帳の合計が食い違う余地をなくす。
-- =============================================================

-- -------------------------------------------------------------
-- payments : 決済記録
--
--   points / bonus_points / amount_yen は Checkout を作った時点の
--   サーバ側の確定値。Webhook はここに焼かれた値だけを見て付与する。
--   (Stripe から返ってきた金額やクライアントの申告値は信用しない)
-- -------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- src/lib/points-plans.ts のプラン ID
  plan_id       text not null,
  -- 請求額(円)。JPY は最小単位が円そのものなので Stripe の amount と一致する
  amount_yen    integer not null check (amount_yen > 0),
  points        integer not null check (points > 0),
  bonus_points  integer not null default 0 check (bonus_points >= 0),
  -- pending: Checkout 作成済 / paid: 入金確認しポイント付与済
  -- failed: 決済失敗 / expired: Checkout が期限切れ
  status        text not null default 'pending'
                  check (status in ('pending','paid','failed','expired')),
  -- Checkout Session を作る前に行を作るので、確定するまでは null
  stripe_session_id        text unique,
  stripe_payment_intent_id text,
  -- 実際に付与したポイント(points + bonus_points)。冪等性チェックの証跡
  credited_points integer not null default 0 check (credited_points >= 0),
  failure_reason  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  paid_at       timestamptz
);

create index if not exists payments_user_idx
  on public.payments (user_id, created_at desc);
-- 未確定のまま放置された Checkout を管理画面で洗い出すため
create index if not exists payments_pending_idx
  on public.payments (created_at desc) where status = 'pending';

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- RLS : 自分の決済履歴だけ読める。書き込みは service_role のみ。
-- -------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- fulfill_stripe_payment() : 入金確定 → ポイント付与
--
--   Stripe の Webhook は「同じイベントを複数回送る」ことを前提に
--   設計されている(再送・タイムアウト・複数エンドポイント)。
--   そのため、この関数は何度呼ばれても付与は1回きりになっている:
--
--     1. payments 行を FOR UPDATE でロック(同時配信を直列化)
--     2. すでに paid なら何もせず already_credited=true を返す
--     3. まだなら credit_points() で付与し、同一トランザクションで
--        payments を paid に更新する
--
--   2 と 3 が同じトランザクションなので、「ポイントは付いたが
--   payments は pending のまま」という状態は発生しない。
-- -------------------------------------------------------------
create or replace function public.fulfill_stripe_payment(
  p_session_id        text,
  p_payment_intent_id text default null,
  p_amount_yen        integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_total   integer;
  v_result  jsonb;
begin
  if coalesce(trim(p_session_id), '') = '' then
    raise exception 'INVALID_SESSION' using errcode = '22023';
  end if;

  select * into v_payment
  from public.payments
  where stripe_session_id = p_session_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 冪等性の要。ここで打ち切るので二重付与が起きない。
  if v_payment.status = 'paid' then
    return jsonb_build_object(
      'already_credited', true,
      'payment_id',       v_payment.id,
      'user_id',          v_payment.user_id,
      'credited',         v_payment.credited_points
    );
  end if;

  -- 期限切れ・失敗として記録済みの決済に、後から入金が乗ることはない。
  -- (Stripe 側で確定した状態と食い違っている = 調査が必要な事象)
  if v_payment.status <> 'pending' then
    raise exception 'PAYMENT_NOT_PENDING' using errcode = '22023';
  end if;

  -- 金額が一致しない = 想定外。付与せず落として調査対象にする。
  if p_amount_yen is not null and p_amount_yen <> v_payment.amount_yen then
    raise exception 'AMOUNT_MISMATCH' using errcode = '22023';
  end if;

  v_total := v_payment.points + v_payment.bonus_points;

  v_result := public.credit_points(
    v_payment.user_id,
    v_payment.points,
    'charge',
    'ポイントチャージ',
    v_payment.id
  );

  -- ボーナスは台帳を分けて記帳する(履歴で内訳が分かるように)
  if v_payment.bonus_points > 0 then
    v_result := public.credit_points(
      v_payment.user_id,
      v_payment.bonus_points,
      'bonus',
      'チャージボーナス',
      v_payment.id
    );
  end if;

  update public.payments
  set status                   = 'paid',
      paid_at                  = now(),
      credited_points          = v_total,
      stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id)
  where id = v_payment.id;

  return jsonb_build_object(
    'already_credited', false,
    'payment_id',       v_payment.id,
    'user_id',          v_payment.user_id,
    'credited',         v_total,
    'balance',          (v_result->>'balance')::bigint
  );
end;
$$;

-- -------------------------------------------------------------
-- fail_stripe_payment() : 決済失敗 / Checkout 期限切れ の記録
--
--   pending の行だけを落とす。すでに paid の行には触らない
--   (後から失敗イベントが届いてもポイントを取り上げない)。
-- -------------------------------------------------------------
create or replace function public.fail_stripe_payment(
  p_session_id text,
  p_status     text,
  p_reason     text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_status not in ('failed','expired') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  update public.payments
  set status         = p_status,
      failure_reason = coalesce(p_reason, '')
  where stripe_session_id = p_session_id
    and status = 'pending';

  get diagnostics v_updated = row_count;

  return jsonb_build_object('updated', v_updated);
end;
$$;

-- -------------------------------------------------------------
-- 実行権限
--   決済確定はサーバ(Webhook)からのみ。ユーザーには一切触らせない。
-- -------------------------------------------------------------
revoke all on function public.fulfill_stripe_payment(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.fulfill_stripe_payment(text, text, integer)
  to service_role;

revoke all on function public.fail_stripe_payment(text, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_stripe_payment(text, text, text)
  to service_role;
