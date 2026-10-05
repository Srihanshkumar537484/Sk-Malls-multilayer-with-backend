import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  unpublished: 'bg-gray-100 text-gray-500',
};

export default async function SellerProductsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: seller } = await supabase.from('sellers').select('id').eq('profile_id', user.id).maybeSingle();
  if (!seller) redirect('/seller/register');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, selling_price, mrp, status, created_at')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Products</h1>
        <Link href="/seller/products/new" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">
          + Add product
        </Link>
      </div>

      {(products ?? []).length === 0 ? (
        <p className="text-gray-600">You haven&apos;t added any products yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2">Product</th>
              <th className="py-2">Price</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((product) => (
              <tr key={product.id} className="border-b border-gray-100">
                <td className="py-3">{product.name}</td>
                <td className="py-3">₹{product.selling_price}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[product.status]}`}>
                    {product.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
