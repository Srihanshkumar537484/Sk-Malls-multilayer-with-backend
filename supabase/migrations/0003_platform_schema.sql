-- ============================================================================
-- SK MALLS — 0003_platform_schema.sql
-- Reviews, wishlists, coupons, returns/refunds, shipping, notifications,
-- banners, store_settings, audit_logs
-- ============================================================================

create type return_status as enum ('requested', 'approved', 'rejected', 'returned', 'refunded');
create type refund_status as enum ('pending', 'processed', 'rejected');
create type coupon_scope as enum ('platform', 'seller', 'category', 'product');
create type discount_type as enum ('percentage', 'fixed');

-- ----------------------------------------------------------------------------
-- REVIEWS
-- ----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null, -- proves verified purchase
  rating smallint not null check (rating between 1 and 5),
  comment text,
  images text[] not null default '{}',
  is_verified_purchase boolean not null default false,
  is_approved boolean not null default false, -- admin moderation required
  created_at timestamptz not null default now(),
  unique (product_id, profile_id, order_item_id)
);

create index idx_reviews_product on public.reviews(product_id);

create table public.seller_reviews (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (seller_id, profile_id)
);

-- ----------------------------------------------------------------------------
-- WISHLISTS
-- ----------------------------------------------------------------------------
create table public.wishlists (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, product_id)
);

-- ----------------------------------------------------------------------------
-- COUPONS
-- ----------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  scope coupon_scope not null default 'platform',
  seller_id uuid references public.sellers(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  discount_type discount_type not null,
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order_value numeric(12,2) not null default 0,
  max_discount_amount numeric(12,2),
  usage_limit integer,             -- total uses allowed, null = unlimited
  per_user_limit integer default 1,
  times_used integer not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  id uuid primary key default uuid_generate_v4(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_discounted numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index idx_coupon_redemptions_coupon on public.coupon_redemptions(coupon_id);

-- ----------------------------------------------------------------------------
-- RETURNS / REFUNDS
-- ----------------------------------------------------------------------------
create table public.returns (
  id uuid primary key default uuid_generate_v4(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  seller_order_id uuid not null references public.seller_orders(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  status return_status not null default 'requested',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default uuid_generate_v4(),
  return_id uuid references public.returns(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_id uuid references public.sellers(id) on delete set null,
  amount numeric(12,2) not null,
  reason text,
  status refund_status not null default 'pending',
  reference text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SHIPPING RULES  (flat / free-threshold, platform-wide or per-seller)
-- ----------------------------------------------------------------------------
create table public.shipping_rules (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid references public.sellers(id) on delete cascade, -- null = platform default
  flat_rate numeric(12,2) not null default 0,
  free_shipping_threshold numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS  (in-app; email is best-effort and never blocks order flow)
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_profile on public.notifications(profile_id, is_read);

create table public.email_log (
  id uuid primary key default uuid_generate_v4(),
  to_email text not null,
  subject text not null,
  template text not null,
  status text not null default 'pending', -- pending | sent | failed
  error_message text,
  related_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- BANNERS / CMS
-- ----------------------------------------------------------------------------
create table public.banners (
  id uuid primary key default uuid_generate_v4(),
  placement text not null, -- 'hero', 'promo', 'category', etc.
  title text,
  subtitle text,
  image_url text not null,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- STORE SETTINGS  (singleton row for mall-wide config)
-- ----------------------------------------------------------------------------
create table public.store_settings (
  id boolean primary key default true check (id), -- enforces exactly one row
  mall_name text not null default 'SK Malls',
  logo_url text,
  support_email text,
  support_phone text,
  whatsapp_number text,
  address text,
  social_links jsonb not null default '{}'::jsonb,
  default_return_window_days integer not null default 7,
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (true);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,          -- e.g. 'seller.approved', 'product.rejected'
  record_table text,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor on public.audit_logs(actor_id);
create index idx_audit_logs_record on public.audit_logs(record_table, record_id);

create trigger trg_returns_updated before update on public.returns
  for each row execute procedure public.set_updated_at();
create trigger trg_store_settings_updated before update on public.store_settings
  for each row execute procedure public.set_updated_at();
