-- ============================================================================
-- SK MALLS — 0010_review_rating_triggers.sql
-- Recomputes products.rating_avg / rating_count (and the seller equivalent)
-- whenever a review's approval status changes, instead of trusting the
-- client to keep those denormalized columns in sync.
-- ============================================================================

create or replace function public.recalc_product_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
    set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = v_product_id and is_approved), 0),
        rating_count = coalesce((select count(*) from public.reviews where product_id = v_product_id and is_approved), 0)
    where p.id = v_product_id;
  return null;
end;
$$;

create trigger trg_reviews_recalc_product_rating
  after insert or update or delete on public.reviews
  for each row execute procedure public.recalc_product_rating();

create or replace function public.recalc_seller_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller_id uuid := coalesce(new.seller_id, old.seller_id);
begin
  update public.stores s
    set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.seller_reviews where seller_id = v_seller_id and is_approved), 0),
        rating_count = coalesce((select count(*) from public.seller_reviews where seller_id = v_seller_id and is_approved), 0)
    where s.seller_id = v_seller_id;
  return null;
end;
$$;

create trigger trg_seller_reviews_recalc_rating
  after insert or update or delete on public.seller_reviews
  for each row execute procedure public.recalc_seller_rating();
