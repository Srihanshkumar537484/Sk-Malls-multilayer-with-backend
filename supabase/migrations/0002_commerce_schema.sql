-- ============================================================================
-- SK MALLS — 0002_commerce_schema.sql
-- Addresses, cart, orders (master + seller sub-orders), payments, commission,
-- seller ledger, payouts
-- ============================================================================

create type order_status as enum (
  'pending', 'confirmed', 'processing', 'packed', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled',
  'return_requested', 'returned', 'refund_pending', 'refunded'
);
create type payment_method as enum ('cod', 'online');
create type payment_status as enum ('pending', 'paid', 'failed', 'refund_pending', 'refunded');
create type ledger_type as enum ('sale', 'commission', 'refund', 'adjustment', 'payout');
create type payout_status as enum ('pending', 'processing', 'paid', 'failed', 'cancelled');

-- ----------------------------------------------------------------------------
-- ADDRESSES
-- ----------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade, -- null for guest checkout snapshot
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_addresses_profile on public.addresses(profile_id);

-- ----------------------------------------------------------------------------
-- CART  (one open cart per customer; guest carts keyed by session_id instead)
-- ----------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  session_id text, -- for guest carts, set from a signed cookie
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or session_id is not null)
);

create unique index idx_carts_profile on public.carts(profile_id) where profile_id is not null;
create unique index idx_carts_session on public.carts(session_id) where session_id is not null;

create table public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index idx_cart_items_cart on public.cart_items(cart_id);

-- ----------------------------------------------------------------------------
-- ORDERS — one master order per checkout, split into per-seller sub-orders.
-- e.g. master ORD10001 -> sub-orders ORD10001-A, ORD10001-B
-- ----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique, -- e.g. ORD10001
  profile_id uuid references public.profiles(id) on delete set null, -- null for guest
  guest_email text,
  guest_phone text,
  shipping_address jsonb not null, -- snapshot at time of order, never re-joined live
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  subtotal numeric(12,2) not null,
  shipping_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null,
  coupon_code text,
  status order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_profile on public.orders(profile_id);
create index idx_orders_status on public.orders(status);

create table public.seller_orders (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  sub_order_number text not null unique, -- e.g. ORD10001-A
  subtotal numeric(12,2) not null,
  shipping_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  commission_rate_pct numeric(5,2) not null,   -- SNAPSHOT at order time — never recalculated
  commission_amount numeric(12,2) not null,     -- SNAPSHOT — locked forever
  seller_net_amount numeric(12,2) not null,     -- subtotal - commission, snapshot
  status order_status not null default 'pending',
  tracking_number text,
  tracking_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_seller_orders_order on public.seller_orders(order_id);
create index idx_seller_orders_seller on public.seller_orders(seller_id);
create index idx_seller_orders_status on public.seller_orders(status);

create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  seller_order_id uuid not null references public.seller_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  size text,
  color text,
  unit_price numeric(12,2) not null,   -- price at time of purchase, snapshot
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index idx_order_items_seller_order on public.order_items(seller_order_id);

-- ----------------------------------------------------------------------------
-- PAYMENTS  (COD row created immediately; online rows populated via gateway
-- webhook once a gateway is configured — see 0005 for the "never trust
-- client" verification function)
-- ----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method payment_method not null,
  status payment_status not null default 'pending',
  amount numeric(12,2) not null,
  gateway text,               -- e.g. 'razorpay', null for COD
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature text,
  raw_webhook_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_order on public.payments(order_id);

-- ----------------------------------------------------------------------------
-- COMMISSION RULES  (priority: product > seller > category > global)
-- ----------------------------------------------------------------------------
create table public.commission_rules (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('global', 'category', 'seller', 'product')),
  category_id uuid references public.categories(id) on delete cascade,
  seller_id uuid references public.sellers(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  commission_pct numeric(5,2) not null check (commission_pct >= 0 and commission_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'global' and category_id is null and seller_id is null and product_id is null) or
    (scope = 'category' and category_id is not null and seller_id is null and product_id is null) or
    (scope = 'seller' and seller_id is not null and category_id is null and product_id is null) or
    (scope = 'product' and product_id is not null and category_id is null and seller_id is null)
  )
);

-- Only one global rule allowed
create unique index idx_commission_global_singleton on public.commission_rules(scope) where scope = 'global';
create unique index idx_commission_category on public.commission_rules(category_id) where scope = 'category';
create unique index idx_commission_seller on public.commission_rules(seller_id) where scope = 'seller';
create unique index idx_commission_product on public.commission_rules(product_id) where scope = 'product';

-- ----------------------------------------------------------------------------
-- SELLER LEDGER  (auditable running record of every financial event)
-- ----------------------------------------------------------------------------
create table public.seller_ledger (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  seller_order_id uuid references public.seller_orders(id) on delete set null,
  type ledger_type not null,
  amount numeric(12,2) not null, -- positive = credit to seller, negative = debit
  status text not null default 'posted', -- posted | pending | reversed
  description text,
  created_at timestamptz not null default now()
);

create index idx_ledger_seller on public.seller_ledger(seller_id);
create index idx_ledger_type on public.seller_ledger(type);

-- ----------------------------------------------------------------------------
-- PAYOUTS  (admin-recorded manual payouts; see FINAL REPORT section for why)
-- ----------------------------------------------------------------------------
create table public.payouts (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  amount numeric(12,2) not null,
  status payout_status not null default 'pending',
  payout_reference text,
  covered_seller_order_ids uuid[] not null default '{}',
  notes text,
  recorded_by uuid references public.profiles(id), -- admin who recorded it
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payouts_seller on public.payouts(seller_id);

create trigger trg_carts_updated before update on public.carts
  for each row execute procedure public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute procedure public.set_updated_at();
create trigger trg_seller_orders_updated before update on public.seller_orders
  for each row execute procedure public.set_updated_at();
create trigger trg_payments_updated before update on public.payments
  for each row execute procedure public.set_updated_at();
create trigger trg_commission_rules_updated before update on public.commission_rules
  for each row execute procedure public.set_updated_at();
create trigger trg_payouts_updated before update on public.payouts
  for each row execute procedure public.set_updated_at();
