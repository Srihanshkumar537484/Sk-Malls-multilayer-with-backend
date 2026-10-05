# SK Malls

A multi-vendor marketplace: SK Malls' own store + approved external sellers,
one cart across sellers, master + per-seller sub-orders, COD-first checkout,
admin-managed commission and payouts. Built for ₹0 initial infrastructure
cost on Supabase (free tier) + any free static/edge host.

This README covers **Layer 1**: project scaffold, full database schema,
RLS policies, seller registration, and an admin dashboard shell. Later
layers (product management, cart/checkout UI, seller dashboard, reviews,
coupons, returns, payouts UI, CMS, SEO, PWA) build on this foundation.

## 1. What's in this layer

- `supabase/migrations/0001-0005` — full schema: profiles/roles, sellers,
  stores, categories, products, variants, inventory, carts, orders +
  seller sub-orders, payments, commission rules, seller ledger, payouts,
  reviews, wishlists, coupons, returns/refunds, shipping, notifications,
  banners, store settings, audit logs — plus Row Level Security policies
  enforcing seller data isolation **in the database**, not just the UI.
- `supabase/migrations/0004_functions.sql` — `checkout_cart()`, the one
  server-side entry point that re-validates price/stock and splits an
  order into per-seller sub-orders with commission snapshotting.
- `supabase/seed/001_initial_data.sql` — the 11 starting categories and
  commission rates from the spec.
- Next.js 14 (App Router, TypeScript, Tailwind) scaffold with:
  - Supabase browser/server/service-role clients
  - Middleware that redirects unauthenticated or wrong-role users away
    from `/admin/*` and `/seller/dashboard*` (RLS is the real guard;
    this is just UX)
  - A real home page reading categories/featured products from Supabase
  - Seller registration form + API route with server-side validation
  - An admin dashboard shell showing live pending-approval counts

## 2. Deploy for ₹0 — exact steps

### A. Create your free Supabase project
1. Go to https://supabase.com → sign up free → **New project**.
2. Choose a name, a database password (save it), and the region closest
   to your customers (e.g. Mumbai/`ap-south-1` for India).
3. Wait for provisioning (~2 minutes).

### B. Run the database migrations
1. In the Supabase dashboard, open **SQL Editor**.
2. Run each file in `supabase/migrations/` **in order**, 0001 → 0005,
   pasting the contents and clicking Run.
3. Then run `supabase/seed/001_initial_data.sql`.
4. Confirm in **Table Editor** that `categories` has 11 rows and
   `commission_rules` has 2 rows.

### C. Get your API keys
1. **Project Settings → API**.
2. Copy the **Project URL**, **anon public** key, and **service_role**
   key (keep the service role key secret — server-only).

### D. Configure the app
1. `cp .env.example .env.local`
2. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. Leave payment/email vars blank for now.

### E. Run it locally
```bash
npm install
npm run dev
```
Visit http://localhost:3000 — you should see the home page with the
seeded categories.

### F. Create your Super Admin account
1. Register a normal account through Supabase Auth (you'll wire up a
   `/login` and `/register` page in the next layer — for now, create a
   user directly in **Authentication → Users → Add user** in the
   Supabase dashboard, or via the app once auth pages exist).
2. In **Table Editor → profiles**, find that user's row and change
   `role` from `customer` to `super_admin`.
3. Log in and visit `/admin/dashboard` — you should see live counts.

### G. Create the SK Malls owner store (so you can sell your own products)
Owner products publish instantly with no admin approval step (spec section
7/13) — but that requires one `sellers` row with `is_owner_store = true`
tied to your own admin account. Create it once, in Table Editor → `sellers`
→ Insert row:
- `profile_id`: your super admin user's id (from `profiles`)
- `business_name`: e.g. "SK Malls"
- `status`: `approved`
- `is_owner_store`: `true`
- fill `contact_name`, `email`, `mobile`, `address`, `city`, `state`,
  `pincode` with your real business details
Then insert a matching `stores` row (`seller_id` = the id you just created,
a unique `slug`, `name`). After that, your admin account can add products
via `/seller/products/new` exactly like any seller, except they go live
immediately.

### H. Deploy free hosting
**Recommended: Vercel free tier** (simplest for Next.js):
1. Push this project to a GitHub repo.
2. https://vercel.com → New Project → import the repo.
3. Add the same environment variables from `.env.local` in Vercel's
   dashboard (Settings → Environment Variables).
4. Deploy. You get a free `*.vercel.app` URL — no custom domain needed.

**Alternative: Cloudflare Pages** works too, but Next.js's server
features (Server Components, Route Handlers, middleware — all used
here) need the `@cloudflare/next-on-pages` adapter, which adds
complexity. Vercel is the more direct free option for this codebase.

## 3. Free-tier limits to know about

- **Supabase free tier**: 500 MB database, 1 GB file storage, 5 GB
  bandwidth/month, and the project **pauses after 7 days of inactivity**
  (you get an email first; unpausing takes one click). Fine for a
  pre-launch or low-traffic store; watch it as you grow.
- **Vercel free (Hobby) tier**: generous bandwidth for a starting store,
  but is licensed for non-commercial personal use per Vercel's terms —
  once SK Malls is a real commercial business, budget for Vercel Pro
  eventually. This does not block a ₹0 *initial* launch.

## 4. Layer 2 — now included

- **Auth**: `/login`, `/register` (Supabase Auth; a DB trigger auto-creates
  the `profiles` row on sign-up).
- **Seller no-code product flow**: `/seller/products/new` follows the exact
  spec order — photo upload → name → category → price/MRP → size/color/stock
  grid → description → shipping/return info → submit. Images upload straight
  to Supabase Storage from the browser; the API route creates the product,
  images, variants, and per-variant inventory rows in one call, and forces
  seller products to `pending_approval` (only the owner store publishes
  directly), per spec section 13.
- **Shop** (`/shop`): category filter, price range, search, sort — reads
  only `status = 'approved'` products, matching what RLS already allows the
  public to see.
- **Product page** (`/product/[slug]`): variant (size/color) picker that
  resolves to the exact `product_variants` row and its live stock.
- **Cart** (`/cart`, `/api/cart`): grouped by seller (spec section 19), with
  a server-side stock re-check on every add.
- **Checkout** (`/checkout`, `/api/checkout`): calls the `checkout_cart()`
  Postgres function directly — this is what actually creates the master
  order + per-seller sub-orders, decrements stock atomically, and snapshots
  commission. COD only, per spec section 21.
- **Order confirmation** (`/account/orders/[id]`): shows the master order
  split by seller sub-order.

### Known gap in this layer
**Guest checkout isn't wired up yet.** The schema supports it
(`carts.session_id`, `orders.guest_email/guest_phone`), and `checkout_cart()`
accepts guest params, but `/cart` and `/checkout` currently redirect to
`/login` for everyone. Wiring a signed session-id cookie for anonymous carts
is a small, self-contained follow-up.

## 5. Layer 3 — now included

- **Admin sellers** (`/admin/sellers`): approve / reject (with reason) /
  suspend / reactivate. Approving auto-creates the seller's public store row.
- **Admin products** (`/admin/products`): approve / reject (with reason) /
  request changes (sends back to draft) / unpublish an approved product.
- **Admin orders** (`/admin/orders`, `/admin/orders/[id]`): every order,
  searchable by order number; detail view shows the full shipping address
  and every seller sub-order with an unrestricted status dropdown.
- **Seller orders** (`/seller/orders`, `/seller/orders/[id]`): a seller sees
  only their own sub-orders (enforced by RLS, not just the query), with a
  status dropdown restricted to the legal next steps for that status (e.g.
  `packed` can only move to `shipped`) — enforced server-side in the API
  route, not just hidden in the UI.
- **Order status side effects**: cancelling a sub-order automatically
  restocks its items and reverses its pending ledger entries; marking a
  sub-order `delivered` moves its ledger entries from `pending` to `posted`
  (this is what makes seller earnings "available" per spec section 28).
- **Audit log**: every admin/seller status change writes an `audit_logs`
  row (who, what, when, old value, new value) — see migration `0007` for
  the insert policy this needed.

## 7. Layer 4 — now included

- **Reviews**: customers can only review a product from a delivered
  order_item they haven't already reviewed (checked server-side, not just
  hidden in the UI). Every review needs admin approval before it's public
  (`/admin/reviews`); `products.rating_avg`/`rating_count` are recalculated
  by a database trigger whenever approval status changes, not by the client.
- **Coupons**: `/admin/coupons` creates platform/seller/category/product
  coupons. `checkout_cart()` (migration `0008`) now actually validates and
  applies them — checks active window, usage limit, per-user limit, minimum
  order value, computes the discount, allocates it proportionally across
  the affected seller sub-orders, and records a `coupon_redemptions` row.
  The checkout page has a coupon code field that flows through.
- **Returns & refunds**: customers request a return per delivered item
  (`/api/returns` → the `request_return()` DB function, migration `0009`),
  sellers or admins approve/reject it (`review_return()`), and admin then
  creates and processes the refund (`/admin/returns`) — which posts a
  matching debit to the seller's ledger. The status-machine transitions
  (`delivered` → `return_requested` → `returned`) are enforced inside the
  database functions themselves, the same pattern as `checkout_cart()`,
  so they can't be skipped by calling the tables directly.

## 8. What's still NOT built

CMS/banner editor, store settings UI, payouts UI (payouts table + RLS
exist, ledger tracks pending/posted correctly, but no page lets admin
record a payout yet), email notifications, WhatsApp button, SEO metadata,
PWA manifest, analytics, guest checkout.
