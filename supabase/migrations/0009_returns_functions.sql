-- ============================================================================
-- SK MALLS — 0009_returns_functions.sql
-- Return request/review flow (spec section 36): Request → Seller/Admin
-- Review → Approved/Rejected → Returned. Implemented as SECURITY DEFINER
-- functions (same pattern as checkout_cart) rather than letting the client
-- write seller_orders.status directly for a return, so the state machine
-- can't be bypassed by calling the tables out of order.
-- ============================================================================

create or replace function public.request_return(p_order_item_id uuid, p_reason text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller_order_id uuid;
  v_order_profile_id uuid;
  v_seller_order_status order_status;
  v_return_id uuid;
begin
  select oi.seller_order_id, o.profile_id, so.status
    into v_seller_order_id, v_order_profile_id, v_seller_order_status
  from public.order_items oi
  join public.seller_orders so on so.id = oi.seller_order_id
  join public.orders o on o.id = so.order_id
  where oi.id = p_order_item_id;

  if v_seller_order_id is null then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;
  if v_order_profile_id is distinct from auth.uid() then
    raise exception 'NOT_YOUR_ORDER';
  end if;
  if v_seller_order_status <> 'delivered' then
    raise exception 'ORDER_NOT_DELIVERED';
  end if;
  if exists (select 1 from public.returns where order_item_id = p_order_item_id and status not in ('rejected')) then
    raise exception 'RETURN_ALREADY_REQUESTED';
  end if;

  insert into public.returns (order_item_id, seller_order_id, profile_id, reason, status)
    values (p_order_item_id, v_seller_order_id, auth.uid(), p_reason, 'requested')
    returning id into v_return_id;

  update public.seller_orders set status = 'return_requested' where id = v_seller_order_id;

  return v_return_id;
end;
$$;

create or replace function public.review_return(p_return_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller_order_id uuid;
  v_owning_seller_id uuid;
  v_caller_seller_id uuid;
  v_caller_is_admin boolean;
begin
  select r.seller_order_id, so.seller_id into v_seller_order_id, v_owning_seller_id
  from public.returns r join public.seller_orders so on so.id = r.seller_order_id
  where r.id = p_return_id;

  if v_seller_order_id is null then
    raise exception 'RETURN_NOT_FOUND';
  end if;

  select public.is_admin() into v_caller_is_admin;
  select id into v_caller_seller_id from public.sellers where profile_id = auth.uid();

  if not v_caller_is_admin and v_caller_seller_id is distinct from v_owning_seller_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if p_approve then
    update public.returns set status = 'approved', admin_notes = p_notes where id = p_return_id;
    update public.seller_orders set status = 'returned' where id = v_seller_order_id;
  else
    update public.returns set status = 'rejected', admin_notes = p_notes where id = p_return_id;
    update public.seller_orders set status = 'delivered' where id = v_seller_order_id;
  end if;
end;
$$;

-- Sellers need to see their own sub-orders' returns; admin sees all
-- (returns RLS from 0005 already covers select — this just confirms the
-- functions above are reachable by both roles via `execute` grants, which
-- Postgres allows to all roles by default for functions owned by the
-- migration role; no additional grant needed under Supabase's default setup).
