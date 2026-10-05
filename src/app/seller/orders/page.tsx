import Link from 'next/link';
import { requireApprovedSeller } from '@/lib/auth/guards';
import { STATUS_LABELS } from '@/lib/orders/status';

export default async function SellerOrdersPage() {
  const { supabase, seller } = await requireApprovedSeller();

  const { data: subOrders } = await supabase
    .from('seller_orders')
    .select('id, sub_order_number, subtotal, status, created_at, orders ( order_number )')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Orders</h1>

      {(subOrders ?? []).length === 0 ? (
        <p className="text-gray-600">No orders yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2">Order</th>
              <th className="py-2">Subtotal</th>
              <th className="py-2">Status</th>
              <th className="py-2">Placed</th>
            </tr>
          </thead>
          <tbody>
            {(subOrders ?? []).map((so: any) => (
              <tr key={so.id} className="border-b border-gray-100">
                <td className="py-3">
                  <Link href={`/seller/orders/${so.id}`} className="text-brand font-medium">{so.sub_order_number}</Link>
                  <p className="text-xs text-gray-500">{so.orders?.order_number}</p>
                </td>
                <td className="py-3">₹{so.subtotal}</td>
                <td className="py-3">{STATUS_LABELS[so.status] ?? so.status}</td>
                <td className="py-3 text-gray-500">{new Date(so.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
