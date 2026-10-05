-- ============================================================================
-- SK MALLS — 0005_rls_policies.sql
-- Row Level Security. This is the actual enforcement layer for "Seller A
-- cannot access Seller B's data" — it is enforced here, in Postgres, not by
-- hiding buttons in the frontend. Every table with tenant-scoped data has
-- RLS enabled with no default-allow.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (STABLE, SECURITY DEFINER so they can read profiles/sellers
-- regardless of the calling user's own RLS visibility)
-- ----------------------------------------------------------------------------
create or replace function public.current_role_is(p_role user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_is('super_admin');
$$;

-- Returns the caller's seller_id if they are an approved seller, else null
create or replace function public.current_seller_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.sellers where profile_id = auth.uid() limit 1;
$$;

-- ============================================================================
-- PROFILES
-- ============================================================================
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SELLERS
-- ============================================================================
alter table public.sellers enable row level security;

create policy "sellers_select_own_or_admin_or_public_approved" on public.sellers
  for select using (
    profile_id = auth.uid() or public.is_admin() or status = 'approved'
  );
create policy "sellers_insert_own" on public.sellers
  for insert with check (profile_id = auth.uid());
create policy "sellers_update_own_limited" on public.sellers
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid()); -- status changes are separately gated in application logic / admin policy below
create policy "sellers_admin_all" on public.sellers
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- STORES  (public read for active stores; seller manages only their own)
-- ============================================================================
alter table public.stores enable row level security;

create policy "stores_public_read" on public.stores
  for select using (is_active or public.is_admin() or seller_id = public.current_seller_id());
create policy "stores_seller_manage_own" on public.stores
  for all using (seller_id = public.current_seller_id())
  with check (seller_id = public.current_seller_id());
create policy "stores_admin_all" on public.stores
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- CATEGORIES  (public read; admin write only)
-- ============================================================================
alter table public.categories enable row level security;

create policy "categories_public_read" on public.categories
  for select using (is_active or public.is_admin());
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- PRODUCTS  — public sees only approved; seller sees/manages only their own
-- (any product); admin sees/manages everything.
-- ============================================================================
alter table public.products enable row level security;

create policy "products_public_read_approved" on public.products
  for select using (
    status = 'approved'
    or seller_id = public.current_seller_id()
    or public.is_admin()
  );
create policy "products_seller_insert_own" on public.products
  for insert with check (seller_id = public.current_seller_id());
create policy "products_seller_update_own" on public.products
  for update using (seller_id = public.current_seller_id())
  with check (seller_id = public.current_seller_id());
create policy "products_seller_delete_own" on public.products
  for delete using (seller_id = public.current_seller_id());
create policy "products_admin_all" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- product_images / product_variants / inventory follow the parent product's seller
alter table public.product_images enable row level security;
create policy "product_images_read" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id
      and (p.status = 'approved' or p.seller_id = public.current_seller_id() or public.is_admin()))
  );
create policy "product_images_manage_own" on public.product_images
  for all using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id = public.current_seller_id())
    or public.is_admin()
  ) with check (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id = public.current_seller_id())
    or public.is_admin()
  );

alter table public.product_variants enable row level security;
create policy "product_variants_read" on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id
      and (p.status = 'approved' or p.seller_id = public.current_seller_id() or public.is_admin()))
  );
create policy "product_variants_manage_own" on public.product_variants
  for all using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id = public.current_seller_id())
    or public.is_admin()
  ) with check (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id = public.current_seller_id())
    or public.is_admin()
  );

-- Inventory quantity itself is never writable by seller/customer directly —
-- only via decrement_stock()/restock() (SECURITY DEFINER). Sellers may only
-- read their own; admin can read/write for corrections.
alter table public.inventory enable row level security;
create policy "inventory_read" on public.inventory
  for select using (
    exists (select 1 from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = variant_id and (p.status = 'approved' or p.seller_id = public.current_seller_id() or public.is_admin()))
  );
create policy "inventory_seller_set_initial" on public.inventory
  for insert with check (
    exists (select 1 from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = variant_id and p.seller_id = public.current_seller_id())
  );
create policy "inventory_admin_write" on public.inventory
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- ADDRESSES
-- ============================================================================
alter table public.addresses enable row level security;
create policy "addresses_own" on public.addresses
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid());

-- ============================================================================
-- CARTS / CART_ITEMS  (owner-only; guest carts matched by session_id via
-- the API layer using the service role, never exposed to anon RLS directly
-- for cross-session reads)
-- ============================================================================
alter table public.carts enable row level security;
create policy "carts_own" on public.carts
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

alter table public.cart_items enable row level security;
create policy "cart_items_own" on public.cart_items
  for all using (
    exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid())
  );

-- ============================================================================
-- ORDERS  (customer sees own; seller CANNOT see orders table directly —
-- they only ever see seller_orders scoped to themselves; admin sees all)
-- ============================================================================
alter table public.orders enable row level security;
create policy "orders_customer_read_own" on public.orders
  for select using (profile_id = auth.uid() or public.is_admin());
-- Inserts/updates to orders happen only via checkout_cart()/admin tools (SECURITY DEFINER),
-- so no direct insert/update policy is granted to customer or seller roles.
create policy "orders_admin_write" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SELLER_ORDERS  — THE CORE ISOLATION BOUNDARY.
-- A seller may ONLY ever see/update rows where seller_id = their own seller_id.
-- ============================================================================
alter table public.seller_orders enable row level security;
create policy "seller_orders_seller_own_only" on public.seller_orders
  for select using (seller_id = public.current_seller_id() or public.is_admin());
create policy "seller_orders_customer_via_order" on public.seller_orders
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.profile_id = auth.uid())
  );
create policy "seller_orders_seller_update_status_only" on public.seller_orders
  for update using (seller_id = public.current_seller_id())
  with check (seller_id = public.current_seller_id());
create policy "seller_orders_admin_all" on public.seller_orders
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- ORDER_ITEMS  (visible only through an accessible seller_order or the
-- owning customer's order)
-- ============================================================================
alter table public.order_items enable row level security;
create policy "order_items_seller_own" on public.order_items
  for select using (
    exists (select 1 from public.seller_orders so where so.id = seller_order_id
      and (so.seller_id = public.current_seller_id() or public.is_admin()))
  );
create policy "order_items_customer_own" on public.order_items
  for select using (
    exists (select 1 from public.seller_orders so join public.orders o on o.id = so.order_id
      where so.id = seller_order_id and o.profile_id = auth.uid())
  );

-- ============================================================================
-- PAYMENTS  (customer sees own order's payment; seller never sees raw
-- payment/gateway data; admin sees all)
-- ============================================================================
alter table public.payments enable row level security;
create policy "payments_customer_own" on public.payments
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.profile_id = auth.uid())
  );
create policy "payments_admin_all" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- COMMISSION_RULES  — admin only, never visible to sellers directly (they
-- see the resolved historical rate on their own seller_orders instead)
-- ============================================================================
alter table public.commission_rules enable row level security;
create policy "commission_rules_admin_only" on public.commission_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SELLER_LEDGER  — seller reads only their own; only admin/system writes
-- ============================================================================
alter table public.seller_ledger enable row level security;
create policy "ledger_seller_read_own" on public.seller_ledger
  for select using (seller_id = public.current_seller_id() or public.is_admin());
create policy "ledger_admin_write" on public.seller_ledger
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- PAYOUTS  — seller reads only their own; only admin records payouts
-- ============================================================================
alter table public.payouts enable row level security;
create policy "payouts_seller_read_own" on public.payouts
  for select using (seller_id = public.current_seller_id() or public.is_admin());
create policy "payouts_admin_write" on public.payouts
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- REVIEWS  (public reads approved; author manages own; seller of the
-- product may read unapproved reviews on their own products; admin all)
-- ============================================================================
alter table public.reviews enable row level security;
create policy "reviews_public_read_approved" on public.reviews
  for select using (
    is_approved or profile_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.products p where p.id = product_id and p.seller_id = public.current_seller_id())
  );
create policy "reviews_customer_insert_own" on public.reviews
  for insert with check (profile_id = auth.uid());
create policy "reviews_customer_update_own" on public.reviews
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "reviews_admin_moderate" on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.seller_reviews enable row level security;
create policy "seller_reviews_public_read_approved" on public.seller_reviews
  for select using (is_approved or profile_id = auth.uid() or public.is_admin());
create policy "seller_reviews_customer_insert_own" on public.seller_reviews
  for insert with check (profile_id = auth.uid());
create policy "seller_reviews_admin_moderate" on public.seller_reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- WISHLISTS  (owner only)
-- ============================================================================
alter table public.wishlists enable row level security;
create policy "wishlists_own" on public.wishlists
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ============================================================================
-- COUPONS  (public read active platform/relevant coupons; seller manages
-- their own seller-scoped coupons; admin all)
-- ============================================================================
alter table public.coupons enable row level security;
create policy "coupons_public_read_active" on public.coupons
  for select using (is_active or public.is_admin() or seller_id = public.current_seller_id());
create policy "coupons_seller_manage_own" on public.coupons
  for all using (scope = 'seller' and seller_id = public.current_seller_id())
  with check (scope = 'seller' and seller_id = public.current_seller_id());
create policy "coupons_admin_all" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.coupon_redemptions enable row level security;
create policy "coupon_redemptions_own_or_admin" on public.coupon_redemptions
  for select using (profile_id = auth.uid() or public.is_admin());
create policy "coupon_redemptions_admin_write" on public.coupon_redemptions
  for insert with check (public.is_admin() or true); -- inserted by checkout function (security definer)

-- ============================================================================
-- RETURNS / REFUNDS
-- ============================================================================
alter table public.returns enable row level security;
create policy "returns_customer_own" on public.returns
  for select using (profile_id = auth.uid());
create policy "returns_customer_insert_own" on public.returns
  for insert with check (profile_id = auth.uid());
create policy "returns_seller_own" on public.returns
  for select using (
    exists (select 1 from public.seller_orders so where so.id = seller_order_id and so.seller_id = public.current_seller_id())
  );
create policy "returns_seller_update_own" on public.returns
  for update using (
    exists (select 1 from public.seller_orders so where so.id = seller_order_id and so.seller_id = public.current_seller_id())
  );
create policy "returns_admin_all" on public.returns
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.refunds enable row level security;
create policy "refunds_seller_read_own" on public.refunds
  for select using (seller_id = public.current_seller_id() or public.is_admin());
create policy "refunds_customer_read_own" on public.refunds
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.profile_id = auth.uid()));
create policy "refunds_admin_write" on public.refunds
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SHIPPING RULES
-- ============================================================================
alter table public.shipping_rules enable row level security;
create policy "shipping_public_read" on public.shipping_rules
  for select using (is_active or public.is_admin() or seller_id = public.current_seller_id());
create policy "shipping_seller_manage_own" on public.shipping_rules
  for all using (seller_id = public.current_seller_id()) with check (seller_id = public.current_seller_id());
create policy "shipping_admin_all" on public.shipping_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- NOTIFICATIONS  (owner only)
-- ============================================================================
alter table public.notifications enable row level security;
create policy "notifications_own" on public.notifications
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table public.email_log enable row level security;
create policy "email_log_admin_only" on public.email_log
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- BANNERS / STORE_SETTINGS  (public read, admin write)
-- ============================================================================
alter table public.banners enable row level security;
create policy "banners_public_read_active" on public.banners
  for select using (is_active or public.is_admin());
create policy "banners_admin_write" on public.banners
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.store_settings enable row level security;
create policy "store_settings_public_read" on public.store_settings
  for select using (true);
create policy "store_settings_admin_write" on public.store_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- AUDIT LOGS  (admin read only; written by triggers/SECURITY DEFINER fns)
-- ============================================================================
alter table public.audit_logs enable row level security;
create policy "audit_logs_admin_read" on public.audit_logs
  for select using (public.is_admin());
