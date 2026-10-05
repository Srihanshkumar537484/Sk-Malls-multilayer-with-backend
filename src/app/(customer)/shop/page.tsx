import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const SORT_OPTIONS: Record<string, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  price_low: { column: 'selling_price', ascending: true },
  price_high: { column: 'selling_price', ascending: false },
  rating: { column: 'rating_avg', ascending: false },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sort?: string; min?: string; max?: string };
}) {
  const supabase = createServerSupabaseClient();
  const sortKey = searchParams.sort && SORT_OPTIONS[searchParams.sort] ? searchParams.sort : 'newest';
  const sort = SORT_OPTIONS[sortKey];

  let query = supabase
    .from('products')
    .select('id, name, slug, selling_price, mrp, rating_avg, category_id, categories(name, slug)')
    .eq('status', 'approved');

  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`);
  }
  if (searchParams.category) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', searchParams.category)
      .maybeSingle();
    if (category) query = query.eq('category_id', category.id);
  }
  if (searchParams.min) query = query.gte('selling_price', Number(searchParams.min));
  if (searchParams.max) query = query.lte('selling_price', Number(searchParams.max));

  const { data: products } = await query.order(sort.column, { ascending: sort.ascending }).limit(48);
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-56 shrink-0">
          <h2 className="font-semibold text-sm text-gray-900 mb-3">Categories</h2>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/shop" className={!searchParams.category ? 'text-brand font-medium' : 'text-gray-700'}>
                All
              </Link>
            </li>
            {(categories ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/shop?category=${c.slug}`}
                  className={searchParams.category === c.slug ? 'text-brand font-medium' : 'text-gray-700'}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>

          <form className="mt-6 space-y-2">
            <h2 className="font-semibold text-sm text-gray-900">Price</h2>
            <div className="flex gap-2">
              <input name="min" type="number" placeholder="Min" defaultValue={searchParams.min}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              <input name="max" type="number" placeholder="Max" defaultValue={searchParams.max}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
            {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
            {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}
            <button type="submit" className="text-sm text-brand font-medium">Apply</button>
          </form>
        </aside>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">{(products ?? []).length} products</p>
            <form>
              {Object.entries(searchParams).map(([key, value]) =>
                key !== 'sort' && value ? <input key={key} type="hidden" name={key} value={value} /> : null
              )}
              <select
                name="sort"
                defaultValue={sortKey}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
              >
                <option value="newest">Newest</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="rating">Rating</option>
              </select>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {(products ?? []).map((product) => (
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
            {(products ?? []).length === 0 && (
              <p className="text-gray-500 text-sm col-span-full py-12 text-center">
                No products match your filters yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
