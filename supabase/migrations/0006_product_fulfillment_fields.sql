-- ============================================================================
-- SK MALLS — 0006_product_fulfillment_fields.sql
-- Adds per-product shipping/return info fields (spec section 12/18) that
-- were missed in 0001. Additive migration — safe to run after 0001-0005.
-- ============================================================================

alter table public.products
  add column if not exists shipping_note text,
  add column if not exists return_note text,
  add column if not exists subcategory_id uuid references public.categories(id) on delete set null;

create index if not exists idx_products_subcategory on public.products(subcategory_id);
