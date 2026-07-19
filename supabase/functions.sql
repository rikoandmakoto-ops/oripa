-- =============================================================
-- ORIPA Platform :: RPC functions
-- schema.sql の後に実行してください。
-- =============================================================

-- -------------------------------------------------------------
-- secure_rand_below(n) : 0 <= x < n の乱数
--   Postgres の random() は暗号学的に安全ではないため、
--   抽選には pgcrypto の gen_random_bytes を使う。
--   48bit(=6byte) に収めて bigint のオーバーフローを避ける。
--   n は在庫総数(高々数万)なので剰余バイアスは無視できる。
-- -------------------------------------------------------------
create or replace function public.secure_rand_below(n bigint)
returns bigint
language plpgsql
volatile
as $$
declare
  b bytea;
  v bigint := 0;
  i int;
begin
  if n is null or n <= 0 then
    return 0;
  end if;
  b := gen_random_bytes(6);
  for i in 0..5 loop
    v := (v << 8) | get_byte(b, i);
  end loop;
  return v % n;
end;
$$;

-- -------------------------------------------------------------
-- draw_oripa(pack_id, count) : オリパを引く
--
-- 在庫消化型の抽選。1トランザクション内で以下をすべて行う:
--   1. ユーザー行をロックしてポイント残高を確認
--   2. パック行をロック(= 同一パックへの同時抽選を直列化し、売り越しを防ぐ)
--   3. 残っているカードから残本数で重み付けした抽選を count 回
--   4. カード残本数 / パック残口数 を減算
--   5. ポイント減算 + 台帳記帳 + 抽選履歴の挿入
--
-- どこかで例外が起きれば全部ロールバックされるので、
-- 「ポイントだけ減ってカードが出ない」状態は起こらない。
-- -------------------------------------------------------------
create or replace function public.draw_oripa(p_pack_id uuid, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_points      bigint;
  v_pack        public.oripa_packs%rowtype;
  v_total_cost  bigint;
  v_available   bigint;
  v_pick        bigint;
  -- 累積和カラム(cum)が付くため rowtype ではなく record で受ける
  v_card        record;
  v_draw_id     uuid;
  v_results     jsonb := '[]'::jsonb;
  v_balance     bigint;
  i             integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_count is null or p_count < 1 then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;

  -- 1) ユーザー行をロック
  select points into v_points
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 2) パック行をロック（同一パックの抽選をここで直列化する）
  select * into v_pack
  from public.oripa_packs
  where id = p_pack_id
  for update;

  if not found then
    raise exception 'PACK_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not v_pack.is_published then
    raise exception 'PACK_NOT_PUBLISHED' using errcode = '22023';
  end if;

  if p_count > v_pack.max_draw_per_try then
    raise exception 'COUNT_EXCEEDS_LIMIT' using errcode = '22023';
  end if;

  -- 実際に引けるのはカード在庫の合計まで
  select coalesce(sum(remaining), 0) into v_available
  from public.oripa_cards
  where pack_id = p_pack_id;

  if v_available < p_count or v_pack.remaining_slots < p_count then
    raise exception 'SOLD_OUT' using errcode = '22023';
  end if;

  v_total_cost := v_pack.price_points::bigint * p_count;

  if v_points < v_total_cost then
    raise exception 'INSUFFICIENT_POINTS' using errcode = '22023';
  end if;

  -- 3) 抽選ループ
  for i in 1..p_count loop
    -- 残本数で重み付けした累積和抽選
    v_pick := public.secure_rand_below(v_available);

    select c.* into v_card
    from (
      select *,
             sum(remaining) over (order by id) as cum
      from public.oripa_cards
      where pack_id = p_pack_id and remaining > 0
    ) c
    where c.cum > v_pick
    order by c.cum asc
    limit 1;

    if not found then
      -- v_available と実在庫が食い違った場合の保険
      raise exception 'SOLD_OUT' using errcode = '22023';
    end if;

    -- 4) 在庫を減らす
    update public.oripa_cards
    set remaining = remaining - 1
    where id = v_card.id;

    v_available := v_available - 1;

    -- 5) 履歴を作る（カード情報はスナップショット）
    insert into public.draws (
      user_id, pack_id, card_id, cost_points,
      card_name, card_rarity, card_image_url, point_value, status
    ) values (
      v_user_id, p_pack_id, v_card.id, v_pack.price_points,
      v_card.name, v_card.rarity, v_card.image_url, v_card.point_value, 'pending'
    )
    returning id into v_draw_id;

    v_results := v_results || jsonb_build_object(
      'draw_id',     v_draw_id,
      'card_id',     v_card.id,
      'name',        v_card.name,
      'rarity',      v_card.rarity,
      'image_url',   v_card.image_url,
      'point_value', v_card.point_value,
      'is_hit',      v_card.is_hit
    );
  end loop;

  -- パックの残口数を減らす
  update public.oripa_packs
  set remaining_slots = remaining_slots - p_count
  where id = p_pack_id;

  -- ポイントを減らして記帳
  v_balance := v_points - v_total_cost;

  update public.profiles set points = v_balance where id = v_user_id;

  insert into public.point_transactions (
    user_id, amount, type, balance_after, reference_id, description
  ) values (
    v_user_id, -v_total_cost, 'draw', v_balance, p_pack_id,
    v_pack.title || ' を' || p_count || '回'
  );

  return jsonb_build_object(
    'cards',   v_results,
    'balance', v_balance,
    'spent',   v_total_cost
  );
end;
$$;

-- -------------------------------------------------------------
-- convert_draws_to_points(draw_ids) : 当選カードをポイントに交換
-- -------------------------------------------------------------
create or replace function public.convert_draws_to_points(p_draw_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total   bigint := 0;
  v_count   integer := 0;
  v_balance bigint;
  r         record;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_draw_ids is null or array_length(p_draw_ids, 1) is null then
    raise exception 'NO_DRAWS_SELECTED' using errcode = '22023';
  end if;

  -- 残高を先にロックしてから明細を処理する（順序を固定してデッドロックを避ける）
  select points into v_balance from public.profiles where id = v_user_id for update;

  for r in
    select id, point_value
    from public.draws
    where id = any(p_draw_ids)
      and user_id = v_user_id
      and status = 'pending'
    order by id
    for update
  loop
    update public.draws set status = 'converted' where id = r.id;
    v_total := v_total + r.point_value;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'NO_ELIGIBLE_DRAWS' using errcode = '22023';
  end if;

  v_balance := v_balance + v_total;
  update public.profiles set points = v_balance where id = v_user_id;

  insert into public.point_transactions (
    user_id, amount, type, balance_after, description
  ) values (
    v_user_id, v_total, 'convert', v_balance,
    'カード' || v_count || '枚をポイント交換'
  );

  return jsonb_build_object('converted', v_count, 'gained', v_total, 'balance', v_balance);
end;
$$;

-- -------------------------------------------------------------
-- request_shipment(draw_ids, 宛先...) : 発送申請
-- -------------------------------------------------------------
create or replace function public.request_shipment(
  p_draw_ids       uuid[],
  p_recipient_name text,
  p_postal_code    text,
  p_address        text,
  p_phone          text,
  p_note           text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_shipment_id uuid;
  v_count       integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if coalesce(trim(p_recipient_name), '') = ''
     or coalesce(trim(p_postal_code), '') = ''
     or coalesce(trim(p_address), '') = ''
     or coalesce(trim(p_phone), '') = '' then
    raise exception 'INCOMPLETE_ADDRESS' using errcode = '22023';
  end if;

  insert into public.shipments (
    user_id, recipient_name, postal_code, address, phone, note
  ) values (
    v_user_id, trim(p_recipient_name), trim(p_postal_code),
    trim(p_address), trim(p_phone), coalesce(p_note, '')
  )
  returning id into v_shipment_id;

  update public.draws
  set status = 'ship_requested', shipment_id = v_shipment_id
  where id = any(p_draw_ids)
    and user_id = v_user_id
    and status = 'pending';

  get diagnostics v_count = row_count;

  if v_count = 0 then
    -- 対象が1枚もなければ申請自体をなかったことにする
    raise exception 'NO_ELIGIBLE_DRAWS' using errcode = '22023';
  end if;

  return jsonb_build_object('shipment_id', v_shipment_id, 'items', v_count);
end;
$$;

-- -------------------------------------------------------------
-- credit_points : ポイント付与（チャージ/管理者調整/返還）
--   service_role からのみ実行可能。決済成功後にサーバー側から呼ぶ。
-- -------------------------------------------------------------
create or replace function public.credit_points(
  p_user_id     uuid,
  p_amount      integer,
  p_type        text,
  p_description text default '',
  p_reference   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select points into v_balance from public.profiles where id = p_user_id for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_balance := v_balance + p_amount;

  if v_balance < 0 then
    raise exception 'INSUFFICIENT_POINTS' using errcode = '22023';
  end if;

  update public.profiles set points = v_balance where id = p_user_id;

  insert into public.point_transactions (
    user_id, amount, type, balance_after, reference_id, description
  ) values (
    p_user_id, p_amount, p_type, v_balance, p_reference, coalesce(p_description, '')
  );

  return jsonb_build_object('balance', v_balance);
end;
$$;

-- -------------------------------------------------------------
-- 実行権限
-- -------------------------------------------------------------
revoke all on function public.credit_points(uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.credit_points(uuid, integer, text, text, uuid) to service_role;

revoke all on function public.secure_rand_below(bigint) from public, anon;

grant execute on function public.draw_oripa(uuid, integer) to authenticated;
grant execute on function public.convert_draws_to_points(uuid[]) to authenticated;
grant execute on function public.request_shipment(uuid[], text, text, text, text, text) to authenticated;
