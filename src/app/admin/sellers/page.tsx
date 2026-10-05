import { requireAdmin } from '@/lib/auth/guards';
import { StatusActionButton } from '@/components/admin/StatusActionButton';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-200 text-gray-700',
};

export default async function AdminSellersPage({ searchParams }: { searchParams: { status?: string } }) {
  const { supabase } = await requireAdmin();
  const filterStatus = searchParams.status;

  let query = supabase
    .from('sellers')
    .select('id, business_name, contact_name, email, mobile, city, state, status, is_owner_store, created_at')
    .eq('is_owner_store', false)
    .order('created_at', { ascending: false });

  if (filterStatus) query = query.eq('status', filterStatus);

  const { data: sellers } = await query;

  const tabs = ['pending', 'approved', 'rejected', 'suspended'];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Sellers</h1>

      <div className="flex gap-2 mb-6 text-sm">
        <a href="/admin/sellers" className={!filterStatus ? 'font-semibold text-brand' : 'text-gray-600'}>All</a>
        {tabs.map((tab) => (
          <a
            key={tab}
            href={`/admin/sellers?status=${tab}`}
            className={filterStatus === tab ? 'font-semibold text-brand capitalize' : 'text-gray-600 capitalize'}
          >
            {tab}
          </a>
        ))}
      </div>

      {(sellers ?? []).length === 0 ? (
        <p className="text-gray-600">No sellers here.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2">Business</th>
              <th className="py-2">Contact</th>
              <th className="py-2">Location</th>
              <th className="py-2">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(sellers ?? []).map((seller) => (
              <tr key={seller.id} className="border-b border-gray-100">
                <td className="py-3">{seller.business_name}</td>
                <td className="py-3">
                  <p>{seller.contact_name}</p>
                  <p className="text-xs text-gray-500">{seller.email} · {seller.mobile}</p>
                </td>
                <td className="py-3">{seller.city}, {seller.state}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[seller.status]}`}>
                    {seller.status}
                  </span>
                </td>
                <td className="py-3 space-x-2">
                  {seller.status === 'pending' && (
                    <>
                      <StatusActionButton endpoint={`/api/admin/sellers/${seller.id}/status`} action="approve" label="Approve" />
                      <StatusActionButton endpoint={`/api/admin/sellers/${seller.id}/status`} action="reject" label="Reject" variant="danger" needsReason />
                    </>
                  )}
                  {seller.status === 'approved' && (
                    <StatusActionButton endpoint={`/api/admin/sellers/${seller.id}/status`} action="suspend" label="Suspend" variant="danger" />
                  )}
                  {seller.status === 'suspended' && (
                    <StatusActionButton endpoint={`/api/admin/sellers/${seller.id}/status`} action="reactivate" label="Reactivate" />
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
