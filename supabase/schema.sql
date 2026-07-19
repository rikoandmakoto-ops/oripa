-- =============================================================
-- ORIPA Platform :: schema
-- Supabase SQL Editor でこのファイルを最初に実行してください。
-- 実行順: schema.sql -> functions.sql -> seed.sql(任意)
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- profiles : Supabase Auth のユーザーに紐づくプロフィール
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  avatar_url    text,
  points        bigint not null default 0 check (points >= 0),
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.profiles.points is 'ポイント残高。増減は必ず point_transactions と同時に行うこと';

-- 新規ユーザー登録時に自動で profiles を作る
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'ゲスト'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- oripa_packs : オリパ(パック)本体
-- -------------------------------------------------------------
create table if not exists public.oripa_packs (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text not null default '',
  image_url        text,
  -- 対応カードゲーム。自由入力にして特定タイトルに縛られないようにする
  category         text not null default 'other',
  price_points     integer not null check (price_points > 0),
  total_slots      integer not null check (total_slots > 0),
  remaining_slots  integer not null check (remaining_slots >= 0),
  -- 1回のガチャで引ける最大連数(10連など)
  max_draw_per_try integer not null default 10 check (max_draw_per_try between 1 and 100),
  is_published     boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint remaining_lte_total check (remaining_slots <= total_slots)
);

create index if not exists oripa_packs_published_idx
  on public.oripa_packs (is_published, sort_order desc, created_at desc);
create index if not exists oripa_packs_category_idx
  on public.oripa_packs (category) where is_published;

-- -------------------------------------------------------------
-- oripa_cards : パックに封入されるカード
--   stock     = 封入総本数(確定値・変更しない)
--   remaining = 残り本数(抽選のたびに減る)
--   排出確率は remaining / sum(remaining) で常に導出される
-- -------------------------------------------------------------
create table if not exists public.oripa_cards (
  id           uuid primary key default gen_random_uuid(),
  pack_id      uuid not null references public.oripa_packs(id) on delete cascade,
  name         text not null,
  image_url    text,
  rarity       text not null default 'C' check (rarity in ('S','A','B','C','D')),
  stock        integer not null check (stock > 0),
  remaining    integer not null check (remaining >= 0),
  -- ポイント交換を選んだ場合に払い戻されるポイント
  point_value  integer not null default 0 check (point_value >= 0),
  -- 目玉カード(一覧で大きく見せる)
  is_hit       boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint card_remaining_lte_stock check (remaining <= stock)
);

create index if not exists oripa_cards_pack_idx on public.oripa_cards (pack_id, sort_order);
-- 抽選時に「残っているカード」だけを高速に引くための部分インデックス
create index if not exists oripa_cards_draftable_idx
  on public.oripa_cards (pack_id, id) where remaining > 0;

-- -------------------------------------------------------------
-- draws : 抽選履歴(= ユーザーが獲得したカード)
-- -------------------------------------------------------------
create table if not exists public.draws (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  pack_id      uuid not null references public.oripa_packs(id) on delete restrict,
  card_id      uuid not null references public.oripa_cards(id) on delete restrict,
  cost_points  integer not null,
  -- 獲得時点のカード情報をスナップショットして残す(後からカードを編集されても履歴が壊れない)
  card_name    text not null,
  card_rarity  text not null,
  card_image_url text,
  point_value  integer not null default 0,
  -- pending: 未選択 / converted: ポイント交換済 / ship_requested: 発送申請中 / shipped: 発送済
  status       text not null default 'pending'
                 check (status in ('pending','converted','ship_requested','shipped')),
  shipment_id  uuid,
  created_at   timestamptz not null default now()
);

create index if not exists draws_user_idx on public.draws (user_id, created_at desc);
create index if not exists draws_user_pending_idx on public.draws (user_id) where status = 'pending';
create index if not exists draws_pack_idx on public.draws (pack_id, created_at desc);

-- -------------------------------------------------------------
-- point_transactions : ポイント入出金の台帳
--   profiles.points はこの台帳の合計と常に一致する
-- -------------------------------------------------------------
create table if not exists public.point_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- 正=付与 / 負=消費
  amount        integer not null,
  type          text not null
                  check (type in ('charge','draw','convert','admin_adjust','refund','bonus')),
  balance_after bigint not null,
  reference_id  uuid,
  description   text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists point_tx_user_idx on public.point_transactions (user_id, created_at desc);

-- -------------------------------------------------------------
-- shipments : 発送申請
-- -------------------------------------------------------------
create table if not exists public.shipments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'requested'
                    check (status in ('requested','preparing','shipped','cancelled')),
  recipient_name  text not null,
  postal_code     text not null,
  address         text not null,
  phone           text not null,
  note            text not null default '',
  tracking_number text,
  created_at      timestamptz not null default now(),
  shipped_at      timestamptz
);

create index if not exists shipments_user_idx on public.shipments (user_id, created_at desc);
create index if not exists shipments_status_idx on public.shipments (status, created_at desc);

alter table public.draws
  drop constraint if exists draws_shipment_id_fkey;
alter table public.draws
  add constraint draws_shipment_id_fkey
  foreign key (shipment_id) references public.shipments(id) on delete set null;

-- -------------------------------------------------------------
-- updated_at 自動更新
-- -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists packs_touch on public.oripa_packs;
create trigger packs_touch before update on public.oripa_packs
  for each row execute function public.touch_updated_at();

-- =============================================================
-- Row Level Security
--   書き込みは基本すべて拒否し、SECURITY DEFINER の RPC か
--   service_role キー(管理者操作)経由でのみ行う。
-- =============================================================

alter table public.profiles           enable row level security;
alter table public.oripa_packs        enable row level security;
alter table public.oripa_cards        enable row level security;
alter table public.draws              enable row level security;
alter table public.point_transactions enable row level security;
alter table public.shipments          enable row level security;

-- profiles: 自分の行だけ読める / 表示名とアバターのみ自分で更新できる
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- NOTE: points / is_admin をクライアントから書き換えられないよう、
--       アプリ側では必ず update_profile RPC 経由で更新すること。
--       (念のため下のトリガでも防御する)

create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  -- service_role からの更新は素通し
  if current_setting('request.jwt.claims', true) is null
     or coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'service_role' then
    return new;
  end if;
  -- 一般ユーザーは points と is_admin を変更できない
  new.points   := old.points;
  new.is_admin := old.is_admin;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- packs / cards: 公開中のものは誰でも読める(未ログインでもトップを見られる)
drop policy if exists "packs_select_published" on public.oripa_packs;
create policy "packs_select_published" on public.oripa_packs
  for select using (is_published = true);

drop policy if exists "cards_select_published" on public.oripa_cards;
create policy "cards_select_published" on public.oripa_cards
  for select using (
    exists (
      select 1 from public.oripa_packs p
      where p.id = oripa_cards.pack_id and p.is_published = true
    )
  );

-- draws / point_transactions / shipments: 自分の分だけ読める。書き込みは不可。
drop policy if exists "draws_select_own" on public.draws;
create policy "draws_select_own" on public.draws
  for select using (auth.uid() = user_id);

drop policy if exists "point_tx_select_own" on public.point_transactions;
create policy "point_tx_select_own" on public.point_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "shipments_select_own" on public.shipments;
create policy "shipments_select_own" on public.shipments
  for select using (auth.uid() = user_id);
