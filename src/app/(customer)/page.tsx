import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = createServerSupabaseClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order')
    .limit(11);

  const { data: featuredProducts } = await supabase
    .from('products')
    .select('id, name, slug, selling_price, mrp')
    .eq('status', 'approved')
    .eq('is_featured', true)
    .limit(8);

  return (
    <div>
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <h1 className="font-display text-3xl sm:text-5xl font-bold max-w-2xl">
            One mall. Every seller. One cart.
          </h1>
          <p className="mt-4 max-w-xl text-brand-light text-lg">
            Shop from SK Malls and independent sellers side by side — pay cash on delivery, no account required to browse.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-block rounded-full bg-brand-accent px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            Start shopping
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="font-display text-xl font-semibold mb-4">Shop by category</h2>
        <div id="categories" className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {(categories ?? []).map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              className="rounded-lg border border-gray-200 p-4 text-center text-sm font-medium hover:border-brand hover:text-brand"
            >
              {category.name}
            </Link>
          ))}
          {(categories ?? []).length === 0 && (
            <p className="text-gray-500 text-sm col-span-full">
              Categories will appear here once the database is seeded — run supabase/seed/001_initial_data.sql.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Featured products</h2>
          <Link href="/shop" className="text-sm text-brand font-medium">View all</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {(featuredProducts ?? []).map((product) => (
            <Link key={product.id} href={`/product/${product.slug}`} className="group">
              <div className="aspect-square rounded-lg bg-gray-100 mb-2" />
              <p className="text-sm font-medium text-gray-900 group-hover:text-brand line-clamp-2">
                {product.name}
              </p>
              <p className="text-sm">
                <span className="font-semibold">₹{product.selling_price}</span>{' '}
                {product.mrp > product.selling_price && (
                  <span className="text-gray-400 line-through ml-1">₹{product.mrp}</span>
                )}
              </p>
            </Link>
          ))}
          {(featuredProducts ?? []).length === 0 && (
            <p className="text-gray-500 text-sm col-span-full">
              No featured products yet — mark a product as featured from the admin CMS once sellers start listing.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
