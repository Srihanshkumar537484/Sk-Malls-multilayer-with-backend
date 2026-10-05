-- ============================================================================
-- SK MALLS — 0001_core_schema.sql
-- Users, roles, sellers, stores, categories, products, variants, inventory
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type user_role as enum ('super_admin', 'seller', 'customer');
create type seller_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type product_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'unpublished');

-- ----------------------------------------------------------------------------
-- PROFILES  (1:1 with auth.users; role lives here, never trust client for it)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- SELLERS  (business/registration info; 1:1 with a profile once approved)
-- ----------------------------------------------------------------------------
create table public.sellers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  email text not null,
  mobile text not null,
  address text not null,
  city text not null,
  state text not null,
  pincode text not null,
  business_category text,
  shop_description text,
  logo_url text,
  status seller_status not null default 'pending',
  rejection_reason text,
  is_owner_store boolean not null default false, -- true for the single SK Malls "owner store"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

create index idx_sellers_status on public.sellers(status);

-- ----------------------------------------------------------------------------
-- STORES  (public storefront for an approved seller; 1:1 with seller)
-- ----------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text,
  logo_url text,
  banner_url text,
  policies text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id)
);

create index idx_stores_slug on public.stores(slug);

-- ----------------------------------------------------------------------------
-- CATEGORIES  (self-referencing for unlimited subcategories, admin-managed)
-- ----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  image_url text,
  default_commission_pct numeric(5,2), -- category-level commission override
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_categories_parent on public.categories(parent_id);

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  brand text,
  mrp numeric(12,2) not null check (mrp >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  fabric text,
  fit text,
  specifications jsonb not null default '{}'::jsonb,
  weight_grams integer,
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  is_bestseller boolean not null default false,
  is_new_arrival boolean not null default true,
  is_on_sale boolean not null default false,
  seo_title text,
  seo_description text,
  status product_status not null default 'draft',
  rejection_reason text,
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (selling_price <= mrp)
);

create index idx_products_seller on public.products(seller_id);
create index idx_products_category on public.products(category_id);
create index idx_products_status on public.products(status);
create index idx_products_slug on public.products(slug);

create table public.product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_product_images_product on public.product_images(product_id);

-- Variants = combination of size/color/etc for one product
create table public.product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  size text,
  color text,
  extra_attributes jsonb not null default '{}'::jsonb, -- e.g. {"material": "cotton"}
  price_override numeric(12,2), -- null = use product.selling_price
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create index idx_variants_product on public.product_variants(product_id);

-- Inventory is per-variant. All stock changes MUST go through decrement_stock() (see 0004).
create table public.inventory (
  id uuid primary key default uuid_generate_v4(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold integer not null default 3,
  updated_at timestamptz not null default now(),
  unique (variant_id)
);

-- ----------------------------------------------------------------------------
-- updated_at helper trigger, reused by later migrations too
-- ----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger trg_sellers_updated before update on public.sellers
  for each row execute procedure public.set_updated_at();
create trigger trg_stores_updated before update on public.stores
  for each row execute procedure public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute procedure public.set_updated_at();
create trigger trg_inventory_updated before update on public.inventory
  for each row execute procedure public.set_updated_at();
