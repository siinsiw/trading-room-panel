-- ─── Trading Room — Supabase Schema ────────────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Markets ────────────────────────────────────────────────────────────────
create table if not exists public.markets (
  id              text primary key,
  name            text not null,
  symbol          text not null,
  "unitWeight"    numeric not null default 100,
  "unitLabel"     text not null default 'گرم',
  "lafzMin"       integer not null default 1,
  "lafzMax"       integer not null default 999,
  "lafzScale"     bigint not null default 1000,
  "mazneCurrent"  bigint not null default 0,
  active          boolean not null default true,
  "createdAt"     timestamptz not null default now()
);

-- ─── App Users (not auth.users) ─────────────────────────────────────────────
create table if not exists public.app_users (
  id                  text primary key,
  "fullName"          text not null,
  phone               text not null,
  "telegramId"        text,
  role                text not null check (role in ('admin','accountant','trader')),
  "depositTether"     numeric,
  "perUnitDeposit"    numeric,
  "commissionPerUnit" bigint,
  active              boolean not null default true,
  "createdAt"         timestamptz not null default now()
);

-- ─── Orders ─────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id               text primary key,
  "traderId"       text not null references public.app_users(id),
  "marketId"       text not null references public.markets(id),
  side             text not null check (side in ('buy','sell')),
  lafz             integer not null,
  "priceToman"     bigint not null,
  quantity         integer not null,
  filled           integer not null default 0,
  remaining        integer not null,
  "settlementDate" text not null,
  status           text not null check (status in ('open','partial','filled','cancelled')),
  "placedAt"       timestamptz not null default now(),
  "cancelledAt"    timestamptz,
  "cancelReason"   text
);

create index if not exists orders_market_date on public.orders("marketId","settlementDate");
create index if not exists orders_trader on public.orders("traderId");

-- ─── Trades ─────────────────────────────────────────────────────────────────
create table if not exists public.trades (
  id               text primary key,
  "marketId"       text not null references public.markets(id),
  "buyerId"        text not null references public.app_users(id),
  "sellerId"       text not null references public.app_users(id),
  "buyOrderId"     text not null,
  "sellOrderId"    text not null,
  quantity         integer not null,
  "priceToman"     bigint not null,
  "settlementDate" text not null,
  "matchedAt"      timestamptz not null default now(),
  settled          boolean not null default false,
  "buyerPnLToman"  bigint,
  "sellerPnLToman" bigint,
  "buyerCommission"  bigint,
  "sellerCommission" bigint
);

create index if not exists trades_market_date on public.trades("marketId","settlementDate");
create index if not exists trades_buyer  on public.trades("buyerId");
create index if not exists trades_seller on public.trades("sellerId");

-- ─── Settlements ────────────────────────────────────────────────────────────
create table if not exists public.settlements (
  id                   text primary key,
  "marketId"           text not null references public.markets(id),
  "settlementDate"     text not null,
  "rateToman"          bigint not null,
  "rateTether"         bigint not null,
  "appliedAt"          timestamptz not null default now(),
  "appliedBy"          text not null,
  "reversedAt"         timestamptz,
  "reversalReason"     text,
  "snapshotBefore"     text not null,
  "totalTradesCount"   integer not null default 0,
  "totalVolumeUnits"   integer not null default 0,
  "totalCommissionToman" bigint not null default 0
);

-- ─── Audit Log ──────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          text primary key,
  "prevId"    text,
  "actorId"   text not null,
  "actorRole" text not null,
  action      text not null,
  payload     jsonb not null default '{}',
  timestamp   timestamptz not null default now()
);

create index if not exists audit_actor on public.audit_log("actorId");

-- ─── Row Level Security (disable for now — admin panel only) ────────────────
alter table public.markets     disable row level security;
alter table public.app_users   disable row level security;
alter table public.orders      disable row level security;
alter table public.trades      disable row level security;
alter table public.settlements disable row level security;
alter table public.audit_log   disable row level security;
