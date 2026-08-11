-- =============================================================
-- ORIPA Platform :: 仮在庫モデル (virtual inventory)
--
-- 在庫を先に持たず、当選が確定してからカードショップ／TCG専門EC
-- で調達するモデルを追加する。
--
-- 実行順: schema.sql -> functions.sql -> このファイル
-- 何度実行しても壊れないように書いてある(冪等)。
--
-- 追加するもの:
--   card_sources       : カードごとの仕入れ先
--   procurement_tasks  : 当選1枚につき1件の調達タスク
--   price_history      : 仕入れ先の価格・在庫の変動履歴
--   draws.status に 'refunded' を追加(調達失敗で返還済み)
--   request_shipment() を差し替えて調達タスクを自動生成
--   set_procurement_status() : 調達ステータス更新 + 失敗時の自動返還
-- =============================================================

-- -------------------------------------------------------------
-- draws.status : 調達失敗による返還済みを表す 'refunded' を追加
-- -------------------------------------------------------------
alter table public.draws drop constraint if exists draws_status_check;
alter table public.draws
  add constraint draws_status_check
  check (status in ('pending','converted','ship_requested','shipped','refunded'));

-- -------------------------------------------------------------
-- card_sources : カードごとの仕入れ先
--
--   priority は「小さいほど優先」。1 が第一候補。
--   price は円。ポイントは 1pt = 1円 換算で利益率を出す。
-- -------------------------------------------------------------
create table if not exists public.card_sources (
  id             uuid primary key default gen_random_uuid(),
  card_id        uuid not null references public.oripa_cards(id) on delete cascade,
  -- 'manual' 以外は Phase 2 の自動巡回で使うショップ識別子
  shop_code      text not null default 'manual'
                   check (shop_code in ('manual','yuyutei','cardrush','toretoku','yahoo')),
  shop_name      text not null,
  url            text not null,
  price          integer not null check (price >= 0),
  stock_status   text not null default 'unknown'
                   check (stock_status in ('in_stock','low_stock','out_of_stock','unknown')),
  -- 分かる場合だけ入れる。不明なら null。
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  priority       integer not null default 1 check (priority >= 1),
  is_active      boolean not null default true,
  note           text not null default '',
  last_checked_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 調達時は「有効な仕入れ先を優先度順に」引くのでその形でインデックスを張る
create index if not exists card_sources_card_idx
  on public.card_sources (card_id, priority, price);
create index if not exists card_sources_active_idx
  on public.card_sources (shop_code, last_checked_at) where is_active;

drop trigger if exists card_sources_touch on public.card_sources;
create trigger card_sources_touch before update on public.card_sources
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- price_history : 仕入れ先 × 日時 の価格・在庫スナップショット
--   Phase 2 の自動巡回はここに積むだけでよい。
-- -------------------------------------------------------------
create table if not exists public.price_history (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references public.card_sources(id) on delete cascade,
  card_id      uuid not null references public.oripa_cards(id) on delete cascade,
  price        integer not null check (price >= 0),
  stock_status text not null
                 check (stock_status in ('in_stock','low_stock','out_of_stock','unknown')),
  -- 'manual' = 管理者の手入力 / 'crawler' = 自動巡回 / 'api' = ショップAPI
  source_kind  text not null default 'manual'
                 check (source_kind in ('manual','crawler','api')),
  checked_at   timestamptz not null default now()
);

create index if not exists price_history_source_idx
  on public.price_history (source_id, checked_at desc);
create index if not exists price_history_card_idx
  on public.price_history (card_id, checked_at desc);

-- 価格か在庫が動いたときだけ履歴を積む。
-- (巡回で毎回同じ値が返ってきてもテーブルが膨らまないようにする)
create or replace function public.log_price_history()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and new.price = old.price
     and new.stock_status = old.stock_status then
    return new;
  end if;

  insert into public.price_history (source_id, card_id, price, stock_status)
  values (new.id, new.card_id, new.price, new.stock_status);

  return new;
end;
$$;

drop trigger if exists card_sources_price_log on public.card_sources;
create trigger card_sources_price_log after insert or update on public.card_sources
  for each row execute function public.log_price_history();

-- -------------------------------------------------------------
-- procurement_tasks : 調達タスク
--   当選カード(draws)1枚につき最大1件。発送申請と同時に作られる。
-- -------------------------------------------------------------
create table if not exists public.procurement_tasks (
  id              uuid primary key default gen_random_uuid(),
  draw_id         uuid not null unique references public.draws(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  card_id         uuid not null references public.oripa_cards(id) on delete restrict,
  shipment_id     uuid references public.shipments(id) on delete set null,
  -- pending:未調達 / ordered:調達済 / shipped:発送済 / completed:完了 / failed:失敗
  status          text not null default 'pending'
                    check (status in ('pending','ordered','shipped','completed','failed')),
  -- 実際に使った仕入れ先と支払額(円)。発注して初めて埋まる。
  source_id       uuid references public.card_sources(id) on delete set null,
  purchase_price  integer check (purchase_price is null or purchase_price >= 0),
  -- 参考値: 発送申請時点での最安の有効な仕入れ先価格
  estimated_price integer check (estimated_price is null or estimated_price >= 0),
  failure_reason  text not null default '',
  refunded_points integer not null default 0 check (refunded_points >= 0),
  admin_note      text not null default '',
  ordered_at      timestamptz,
  completed_at    timestamptz,
  failed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists procurement_status_idx
  on public.procurement_tasks (status, created_at desc);
create index if not exists procurement_shipment_idx
  on public.procurement_tasks (shipment_id);
create index if not exists procurement_user_idx
  on public.procurement_tasks (user_id, created_at desc);

drop trigger if exists procurement_touch on public.procurement_tasks;
create trigger procurement_touch before update on public.procurement_tasks
  for each row execute function public.touch_updated_at();

-- =============================================================
-- Row Level Security
--   仕入れ先と価格は営業秘密なので一般ユーザーには一切見せない。
--   (ポリシーを1つも作らない = service_role 以外は読めない)
--   調達タスクは「自分の分の進捗」だけ見せる。
-- =============================================================
alter table public.card_sources      enable row level security;
alter table public.price_history     enable row level security;
alter table public.procurement_tasks enable row level security;

drop policy if exists "procurement_select_own" on public.procurement_tasks;
create policy "procurement_select_own" on public.procurement_tasks
  for select using (auth.uid() = user_id);

-- =============================================================
-- request_shipment() を差し替え
--   既存の挙動(発送申請の作成 + draws の状態遷移)はそのままに、
--   対象カード1枚ごとに調達タスクを作るところだけ足している。
--   draw_oripa() は触らない。
-- =============================================================
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

  -- 仮在庫モデル: ここで初めて「調達しなければならないカード」が確定する。
  -- estimated_price には申請時点で最安の有効な仕入れ先価格を焼き込んでおく
  -- (後から仕入れ先の価格が動いても、当時の想定原価が分かるようにするため)。
  insert into public.procurement_tasks (
    draw_id, user_id, card_id, shipment_id, estimated_price
  )
  select
    d.id,
    d.user_id,
    d.card_id,
    v_shipment_id,
    (
      select min(s.price)
      from public.card_sources s
      where s.card_id = d.card_id
        and s.is_active
        and s.stock_status <> 'out_of_stock'
    )
  from public.draws d
  where d.shipment_id = v_shipment_id
  on conflict (draw_id) do nothing;

  return jsonb_build_object('shipment_id', v_shipment_id, 'items', v_count);
end;
$$;

-- =============================================================
-- set_procurement_status(...) : 調達タスクのステータス更新
--
--   失敗にした瞬間にポイントを自動返還する。返還額は
--   「支払ったポイント」と「ポイント交換していたら貰えた額」の
--   大きい方 = ユーザーが絶対に損しない額。
--
--   返還・在庫戻し・draws の更新を1トランザクションでやるので、
--   「返還されたのにカードは発送待ちのまま」といった中途半端な
--   状態にはならない。service_role からのみ実行可能。
-- =============================================================
create or replace function public.set_procurement_status(
  p_task_id        uuid,
  p_status         text,
  p_source_id      uuid default null,
  p_purchase_price integer default null,
  p_admin_note     text default null,
  p_failure_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task    public.procurement_tasks%rowtype;
  v_draw    public.draws%rowtype;
  v_refund  integer := 0;
  v_balance bigint;
begin
  if p_status not in ('pending','ordered','shipped','completed','failed') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  select * into v_task
  from public.procurement_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 返還済みのタスクを触って二重返還が起きないよう、ここで打ち切る
  if v_task.status = 'failed' and v_task.refunded_points > 0 and p_status <> 'failed' then
    raise exception 'ALREADY_REFUNDED' using errcode = '22023';
  end if;

  select * into v_draw from public.draws where id = v_task.draw_id for update;

  update public.procurement_tasks
  set status         = p_status,
      source_id      = coalesce(p_source_id, source_id),
      purchase_price = coalesce(p_purchase_price, purchase_price),
      admin_note     = coalesce(p_admin_note, admin_note),
      failure_reason = case when p_status = 'failed'
                            then coalesce(p_failure_reason, failure_reason)
                            else failure_reason end,
      ordered_at     = case when p_status = 'ordered' and ordered_at is null
                            then now() else ordered_at end,
      completed_at   = case when p_status = 'completed' then now() else null end,
      failed_at      = case when p_status = 'failed' then now() else null end
  where id = p_task_id;

  if p_status = 'failed' and v_task.refunded_points = 0 then
    -- 引いたときに払った額 と ポイント交換していたら貰えた額 の大きい方
    v_refund := greatest(v_draw.cost_points, v_draw.point_value);

    select points into v_balance from public.profiles where id = v_task.user_id for update;
    v_balance := v_balance + v_refund;

    update public.profiles set points = v_balance where id = v_task.user_id;

    insert into public.point_transactions (
      user_id, amount, type, balance_after, reference_id, description
    ) values (
      v_task.user_id, v_refund, 'refund', v_balance, v_task.draw_id,
      v_draw.card_name || ' の調達不可により返還'
    );

    update public.procurement_tasks
    set refunded_points = v_refund
    where id = p_task_id;

    -- カードはユーザーの手元に渡らないので、発送対象から外す
    update public.draws
    set status = 'refunded', shipment_id = null
    where id = v_task.draw_id;

    -- NOTE: oripa_cards.remaining は意図的に戻さない。
    --   調達できなかった = そのカードはもう市場から取れないということなので、
    --   在庫に戻すと次に引いた人もまた調達失敗する。
    --   再販したい場合は管理画面から封入数を編集すること。

  elsif p_status = 'completed' then
    update public.draws set status = 'shipped' where id = v_task.draw_id;
  end if;

  return jsonb_build_object(
    'task_id',  p_task_id,
    'status',   p_status,
    'refunded', v_refund
  );
end;
$$;

-- -------------------------------------------------------------
-- 実行権限
--   調達まわりは管理者操作なので service_role からのみ。
--   アプリ側では必ず requireAdmin() を通してから呼ぶこと。
-- -------------------------------------------------------------
revoke all on function public.set_procurement_status(uuid, text, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.set_procurement_status(uuid, text, uuid, integer, text, text)
  to service_role;

grant execute on function public.request_shipment(uuid[], text, text, text, text, text)
  to authenticated;
