-- ============================================================================
-- SK MALLS — 0004_functions.sql
-- Server-side logic that must never be replicated client-side:
--   - atomic, transaction-safe stock decrement (prevents overselling)
--   - order/sub-order numbering
--   - commission rate resolution (product > seller > category > global)
--   - checkout: validates price+stock server-side and creates the whole
--     master order + sub-orders + ledger entries in one transaction
-- All are SECURITY DEFINER and are the ONLY way price/stock/commission
-- fields get written — RLS on the underlying tables blocks direct writes
-- from customers/sellers (see 0005).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Atomic stock decrement. Raises an exception (aborting the transaction) if
-- insufficient stock — this is what "prevent purchasing more than available
-- stock" actually means at the DB level, not just a UI check.
-- ----------------------------------------------------------------------------
create or replace function public.decrement_stock(p_variant_id uuid, p_qty integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.inventory
  set quantity = quantity - p_qty
  where variant_id = p_variant_id
    and quantity >= p_qty
  returning quantity into v_updated;

  if v_updated is null then
    raise exception 'INSUFFICIENT_STOCK: variant % does not have % units available', p_variant_id, p_qty;
  end if;
end;
$$;

create or replace function public.restock(p_variant_id uuid, p_qty integer)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.inventory
  set quantity = quantity + p_qty
  where variant_id = p_variant_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Order numbering: ORD10001, ORD10002, ... and sub-order suffix -A, -B, -C
-- ----------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 10001;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'ORD' || nextval('public.order_number_seq')::text;
$$;

-- ----------------------------------------------------------------------------
-- Commission resolution: product-level > seller-level > category-level > global
-- ----------------------------------------------------------------------------
create or replace function public.resolve_commission_pct(p_product_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_seller_id uuid;
  v_category_id uuid;
  v_pct numeric;
begin
  select seller_id, category_id into v_seller_id, v_category_id
  from public.products where id = p_product_id;

  select commission_pct into v_pct from public.commission_rules
    where scope = 'product' and product_id = p_product_id limit 1;
  if v_pct is not null then return v_pct; end if;

  select commission_pct into v_pct from public.commission_rules
    where scope = 'seller' and seller_id = v_seller_id limit 1;
  if v_pct is not null then return v_pct; end if;

  select commission_pct into v_pct from public.commission_rules
    where scope = 'category' and category_id = v_category_id limit 1;
  if v_pct is not null then return v_pct; end if;

  select commission_pct into v_pct from public.commission_rules
    where scope = 'global' limit 1;
  if v_pct is not null then return v_pct; end if;

  return 10.0; -- hard fallback default
end;
$$;

-- ----------------------------------------------------------------------------
-- CHECKOUT — the single entry point for turning a cart into a real order.
-- Re-validates price and stock server-side (cart_items.quantity vs live
-- inventory, and live product price — NEVER the price the client sent).
-- Splits into per-seller sub-orders, snapshots commission, writes the
-- seller ledger, and decrements stock — all inside one transaction so a
-- failure anywhere rolls the whole checkout back.
-- ----------------------------------------------------------------------------
create or replace function public.checkout_cart(
  p_cart_id uuid,
  p_profile_id uuid,           -- null for guest
  p_guest_email text,
  p_guest_phone text,
  p_shipping_address jsonb,
  p_payment_method payment_method,
  p_coupon_code text default null
)
returns uuid   -- returns the new orders.id
language plpgsql
security definer set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_item record;
  v_seller_id uuid;
  v_seller_order_id uuid;
  v_sub_order_number text;
  v_current_price numeric;
  v_commission_pct numeric;
  v_commission_amt numeric;
  v_seller_net numeric;
  v_seller_subtotal numeric;
  v_grand_total numeric := 0;
  v_seller_suffix_code integer := 65; -- ascii 'A'
  v_shipping_flat numeric;
begin
  -- Lock and read all cart items with their live product/variant state
  create temporary table tmp_checkout_items on commit drop as
  select
    ci.id as cart_item_id,
    ci.product_id,
    ci.variant_id,
    ci.seller_id,
    ci.quantity,
    p.name as product_name,
    p.selling_price,
    p.status as product_status,
    pv.size,
    pv.color,
    pv.price_override,
    i.quantity as stock_qty
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  join public.product_variants pv on pv.id = ci.variant_id
  join public.inventory i on i.variant_id = ci.variant_id
  where ci.cart_id = p_cart_id
  for update of i;

  if not exists (select 1 from tmp_checkout_items) then
    raise exception 'EMPTY_CART';
  end if;

  -- Validate stock and product status server-side
  if exists (select 1 from tmp_checkout_items where product_status <> 'approved') then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;
  if exists (select 1 from tmp_checkout_items where stock_qty < quantity) then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  v_order_number := public.next_order_number();

  insert into public.orders (
    order_number, profile_id, guest_email, guest_phone, shipping_address,
    payment_method, payment_status, subtotal, grand_total, coupon_code, status
  ) values (
    v_order_number, p_profile_id, p_guest_email, p_guest_phone, p_shipping_address,
    p_payment_method,
    case when p_payment_method = 'cod' then 'pending' else 'pending' end,
    0, 0, p_coupon_code, 'pending'
  ) returning id into v_order_id;

  -- One sub-order per distinct seller in the cart
  for v_seller_id in select distinct seller_id from tmp_checkout_items loop
    select coalesce(sf.flat_rate, 0) into v_shipping_flat
      from public.shipping_rules sf where sf.seller_id = v_seller_id and sf.is_active
      limit 1;

    v_sub_order_number := v_order_number || '-' || chr(v_seller_suffix_code);
    v_seller_suffix_code := v_seller_suffix_code + 1;

    select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
      into v_seller_subtotal
      from tmp_checkout_items where seller_id = v_seller_id;

    insert into public.seller_orders (
      order_id, seller_id, sub_order_number, subtotal, shipping_total,
      commission_rate_pct, commission_amount, seller_net_amount, status
    ) values (
      v_order_id, v_seller_id, v_sub_order_number, v_seller_subtotal,
      coalesce(v_shipping_flat, 0), 0, 0, 0, 'pending'
    ) returning id into v_seller_order_id;

    -- Order items + per-item commission (product-level rules can vary within a seller)
    for v_item in select * from tmp_checkout_items where seller_id = v_seller_id loop
      v_current_price := coalesce(v_item.price_override, v_item.selling_price);
      v_commission_pct := public.resolve_commission_pct(v_item.product_id);
      v_commission_amt := round(v_current_price * v_item.quantity * v_commission_pct / 100.0, 2);

      insert into public.order_items (
        seller_order_id, product_id, variant_id, product_name_snapshot,
        size, color, unit_price, quantity, line_total
      ) values (
        v_seller_order_id, v_item.product_id, v_item.variant_id, v_item.product_name,
        v_item.size, v_item.color, v_current_price, v_item.quantity,
        v_current_price * v_item.quantity
      );

      perform public.decrement_stock(v_item.variant_id, v_item.quantity);
    end loop;

    -- Aggregate commission for the whole sub-order (sum of per-item commission)
    select coalesce(sum(round(coalesce(pv.price_override, p.selling_price) * oi.quantity
                * public.resolve_commission_pct(oi.product_id) / 100.0, 2)), 0)
      into v_commission_amt
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.product_variants pv on pv.id = oi.variant_id
      where oi.seller_order_id = v_seller_order_id;

    v_seller_net := v_seller_subtotal - v_commission_amt;

    update public.seller_orders
      set commission_amount = v_commission_amt,
          commission_rate_pct = case when v_seller_subtotal > 0
            then round(v_commission_amt / v_seller_subtotal * 100.0, 2) else 0 end,
          seller_net_amount = v_seller_net
      where id = v_seller_order_id;

    -- Ledger: gross sale credit, commission debit — kept as separate rows for auditability
    insert into public.seller_ledger (seller_id, seller_order_id, type, amount, status, description)
      values (v_seller_id, v_seller_order_id, 'sale', v_seller_subtotal, 'pending',
              'Sale for ' || v_sub_order_number);
    insert into public.seller_ledger (seller_id, seller_order_id, type, amount, status, description)
      values (v_seller_id, v_seller_order_id, 'commission', -v_commission_amt, 'pending',
              'Commission for ' || v_sub_order_number);

    v_grand_total := v_grand_total + v_seller_subtotal + coalesce(v_shipping_flat, 0);
  end loop;

  update public.orders
    set subtotal = v_grand_total, grand_total = v_grand_total
    where id = v_order_id;

  insert into public.payments (order_id, method, status, amount)
    values (v_order_id, p_payment_method, 'pending', v_grand_total);

  -- Clear the cart
  delete from public.cart_items where cart_id = p_cart_id;

  return v_order_id;
end;
$$;
