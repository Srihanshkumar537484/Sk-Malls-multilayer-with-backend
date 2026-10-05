import { requireAdmin } from '@/lib/auth/guards';
import { StatusActionButton } from '@/components/admin/StatusActionButton';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  unpublished: 'bg-gray-100 text-gray-500',
};

export default async function AdminProductsPage({ searchParams }: { searchParams: { status?: string } }) {
  const { supabase } = await requireAdmin();
  const filterStatus = searchParams.status ?? 'pending_approval';

  const { data: products } = await supabase
    .from('products')
    .select('id, name, selling_price, mrp, status, created_at, sellers ( business_name )')
    .eq('status', filterStatus)
    .order('created_at', { ascending: false });

  const tabs = ['pending_approval', 'approved', 'rejected', 'draft', 'unpublished'];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Products</h1>

      <div className="flex gap-3 mb-6 text-sm flex-wrap">
        {tabs.map((tab) => (
          <a
            key={tab}
            href={`/admin/products?status=${tab}`}
            className={filterStatus === tab ? 'font-semibold text-brand' : 'text-gray-600'}
          >
            {tab.replace('_', ' ')}
          </a>
        ))}
      </div>

      {(products ?? []).length === 0 ? (
        <p className="text-gray-600">Nothing here.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2">Product</th>
              <th className="py-2">Seller</th>
              <th className="py-2">Price</th>
              <th className="py-2">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((product: any) => (
              <tr key={product.id} className="border-b border-gray-100">
                <td className="py-3">{product.name}</td>
                <td className="py-3">{product.sellers?.business_name}</td>
                <td className="py-3">₹{product.selling_price}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[product.status]}`}>
                    {product.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 space-x-2">
                  {product.status === 'pending_approval' && (
                    <>
                      <StatusActionButton endpoint={`/api/admin/products/${product.id}/status`} action="approve" label="Approve" />
                      <StatusActionButton endpoint={`/api/admin/products/${product.id}/status`} action="reject" label="Reject" variant="danger" needsReason />
                      <StatusActionButton endpoint={`/api/admin/products/${product.id}/status`} action="request_changes" label="Request changes" />
                    </>
                  )}
                  {product.status === 'approved' && (
                    <StatusActionButton endpoint={`/api/admin/products/${product.id}/status`} action="unpublish" label="Unpublish" variant="danger" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
