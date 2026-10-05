-- ============================================================================
-- SK MALLS — seed/001_initial_data.sql
-- Initial categories + starting commission rules, per the spec.
-- Safe to re-run (idempotent on slug/scope conflicts).
-- ============================================================================

insert into public.categories (name, slug, sort_order) values
  ('Fashion & Clothing', 'fashion-clothing', 1),
  ('Shoes', 'shoes', 2),
  ('Electronics', 'electronics', 3),
  ('Beauty & Cosmetics', 'beauty-cosmetics', 4),
  ('Home & Kitchen', 'home-kitchen', 5),
  ('Gifts', 'gifts', 6),
  ('Books & Stationery', 'books-stationery', 7),
  ('Grocery', 'grocery', 8),
  ('Jewellery & Accessories', 'jewellery-accessories', 9),
  ('Kids', 'kids', 10),
  ('Sports & Fitness', 'sports-fitness', 11)
on conflict (slug) do nothing;

-- Global default commission (used when no category/seller/product rule matches)
insert into public.commission_rules (scope, commission_pct)
  values ('global', 10.0)
  on conflict do nothing;

-- Category overrides per the spec (Electronics = 5%, everything else = 10%,
-- and 10% is already the global default so only Electronics needs a row)
insert into public.commission_rules (scope, category_id, commission_pct)
  select 'category', id, 5.0 from public.categories where slug = 'electronics'
  on conflict do nothing;

-- Platform-wide default shipping (flat rate, admin-editable later)
insert into public.shipping_rules (seller_id, flat_rate, free_shipping_threshold)
  values (null, 49.0, 999.0);
