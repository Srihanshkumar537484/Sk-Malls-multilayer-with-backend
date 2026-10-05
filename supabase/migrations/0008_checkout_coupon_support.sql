-- ============================================================================
-- SK MALLS — 0008_checkout_coupon_support.sql
-- Replaces checkout_cart() (same signature, safe to re-create) to actually
-- validate and apply a coupon code, instead of just accepting the param.
-- Supports platform/seller/category/product scoped coupons (spec section 38).
-- ============================================================================

create or replace function public.checkout_cart(
  p_cart_id uuid,
  p_profile_id uuid,
  p_guest_email text,
  p_guest_phone text,
  p_shipping_address jsonb,
  p_payment_method payment_method,
  p_coupon_code text default null
)
returns uuid
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
  v_seller_suffix_code integer := 65;
  v_shipping_flat numeric;
  v_cart_subtotal numeric := 0;
  v_coupon record;
  v_matched_amount numeric := 0;
  v_total_discount numeric := 0;
  v_seller_discount numeric;
  v_uses_by_user integer;
begin
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
    p.category_id,
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

  if exists (select 1 from tmp_checkout_items where product_status <> 'approved') then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;
  if exists (select 1 from tmp_checkout_items where stock_qty < quantity) then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
    into v_cart_subtotal from tmp_checkout_items;

  -- ---- Coupon validation & discount calculation --------------------------
  if p_coupon_code is not null then
    select * into v_coupon from public.coupons
      where code = p_coupon_code and is_active
        and now() >= starts_at and (expires_at is null or now() <= expires_at)
      limit 1;

    if v_coupon.id is null then
      raise exception 'INVALID_COUPON';
    end if;

    if v_coupon.usage_limit is not null and v_coupon.times_used >= v_coupon.usage_limit then
      raise exception 'COUPON_LIMIT_REACHED';
    end if;

    if p_profile_id is not null and v_coupon.per_user_limit is not null then
      select count(*) into v_uses_by_user from public.coupon_redemptions
        where coupon_id = v_coupon.id and profile_id = p_profile_id;
      if v_uses_by_user >= v_coupon.per_user_limit then
        raise exception 'COUPON_ALREADY_USED';
      end if;
    end if;

    if v_cart_subtotal < v_coupon.min_order_value then
      raise exception 'COUPON_MIN_ORDER_NOT_MET';
    end if;

    -- Base amount the discount percentage/fixed value applies to, per scope
    v_matched_amount := case v_coupon.scope
      when 'platform' then v_cart_subtotal
      when 'seller' then (select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
                           from tmp_checkout_items where seller_id = v_coupon.seller_id)
      when 'category' then (select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
                             from tmp_checkout_items where category_id = v_coupon.category_id)
      when 'product' then (select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
                            from tmp_checkout_items where product_id = v_coupon.product_id)
      else 0
    end;

    if v_matched_amount <= 0 then
      raise exception 'COUPON_NOT_APPLICABLE';
    end if;

    v_total_discount := case v_coupon.discount_type
      when 'percentage' then round(v_matched_amount * v_coupon.discount_value / 100.0, 2)
      else least(v_coupon.discount_value, v_matched_amount)
    end;

    if v_coupon.max_discount_amount is not null then
      v_total_discount := least(v_total_discount, v_coupon.max_discount_amount);
    end if;
  end if;

  v_order_number := public.next_order_number();

  insert into public.orders (
    order_number, profile_id, guest_email, guest_phone, shipping_address,
    payment_method, payment_status, subtotal, discount_total, grand_total, coupon_code, status
  ) values (
    v_order_number, p_profile_id, p_guest_email, p_guest_phone, p_shipping_address,
    p_payment_method, 'pending', v_cart_subtotal, v_total_discount, 0,
    case when v_coupon.id is not null then p_coupon_code else null end, 'pending'
  ) returning id into v_order_id;

  for v_seller_id in select distinct seller_id from tmp_checkout_items loop
    select coalesce(sf.flat_rate, 0) into v_shipping_flat
      from public.shipping_rules sf where sf.seller_id = v_seller_id and sf.is_active
      limit 1;

    v_sub_order_number := v_order_number || '-' || chr(v_seller_suffix_code);
    v_seller_suffix_code := v_seller_suffix_code + 1;

    select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
      into v_seller_subtotal
      from tmp_checkout_items where seller_id = v_seller_id;

    -- This seller's share of the discount, proportional to how much of the
    -- coupon's matched base amount their items contributed.
    v_seller_discount := 0;
    if v_coupon.id is not null and v_matched_amount > 0 then
      declare
        v_seller_matched numeric;
      begin
        v_seller_matched := case v_coupon.scope
          when 'platform' then v_seller_subtotal
          when 'seller' then (case when v_seller_id = v_coupon.seller_id then v_seller_subtotal else 0 end)
          when 'category' then (select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
                                 from tmp_checkout_items where seller_id = v_seller_id and category_id = v_coupon.category_id)
          when 'product' then (select coalesce(sum(coalesce(price_override, selling_price) * quantity), 0)
                                from tmp_checkout_items where seller_id = v_seller_id and product_id = v_coupon.product_id)
          else 0
        end;
        v_seller_discount := round(v_total_discount * v_seller_matched / v_matched_amount, 2);
      end;
    end if;

    insert into public.seller_orders (
      order_id, seller_id, sub_order_number, subtotal, shipping_total, discount_total,
      commission_rate_pct, commission_amount, seller_net_amount, status
    ) values (
      v_order_id, v_seller_id, v_sub_order_number, v_seller_subtotal,
      coalesce(v_shipping_flat, 0), v_seller_discount, 0, 0, 0, 'pending'
    ) returning id into v_seller_order_id;

    for v_item in select * from tmp_checkout_items where seller_id = v_seller_id loop
      v_current_price := coalesce(v_item.price_override, v_item.selling_price);

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

    select coalesce(sum(round(coalesce(pv.price_override, p.selling_price) * oi.quantity
                * public.resolve_commission_pct(oi.product_id) / 100.0, 2)), 0)
      into v_commission_amt
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.product_variants pv on pv.id = oi.variant_id
      where oi.seller_order_id = v_seller_order_id;

    -- Commission is calculated on the pre-discount subtotal (the seller's
    -- gross sale) — the discount is a platform/seller marketing cost, not a
    -- reduction to what the seller earned on the sale itself.
    v_seller_net := v_seller_subtotal - v_commission_amt - v_seller_discount;

    update public.seller_orders
      set commission_amount = v_commission_amt,
          commission_rate_pct = case when v_seller_subtotal > 0
            then round(v_commission_amt / v_seller_subtotal * 100.0, 2) else 0 end,
          seller_net_amount = v_seller_net
      where id = v_seller_order_id;

    insert into public.seller_ledger (seller_id, seller_order_id, type, amount, status, description)
      values (v_seller_id, v_seller_order_id, 'sale', v_seller_subtotal, 'pending',
              'Sale for ' || v_sub_order_number);
    insert into public.seller_ledger (seller_id, seller_order_id, type, amount, status, description)
      values (v_seller_id, v_seller_order_id, 'commission', -v_commission_amt, 'pending',
              'Commission for ' || v_sub_order_number);
    if v_seller_discount > 0 then
      insert into public.seller_ledger (seller_id, seller_order_id, type, amount, status, description)
        values (v_seller_id, v_seller_order_id, 'adjustment', -v_seller_discount, 'pending',
                'Coupon discount (' || p_coupon_code || ') for ' || v_sub_order_number);
    end if;

    v_grand_total := v_grand_total + v_seller_subtotal + coalesce(v_shipping_flat, 0) - v_seller_discount;
  end loop;

  update public.orders
    set subtotal = v_cart_subtotal, grand_total = v_grand_total
    where id = v_order_id;

  insert into public.payments (order_id, method, status, amount)
    values (v_order_id, p_payment_method, 'pending', v_grand_total);

  if v_coupon.id is not null then
    update public.coupons set times_used = times_used + 1 where id = v_coupon.id;
    insert into public.coupon_redemptions (coupon_id, profile_id, order_id, amount_discounted)
      values (v_coupon.id, p_profile_id, v_order_id, v_total_discount);
  end if;

  delete from public.cart_items where cart_id = p_cart_id;

  return v_order_id;
end;
$$;
