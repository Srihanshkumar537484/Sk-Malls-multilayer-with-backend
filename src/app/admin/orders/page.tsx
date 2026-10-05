import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/guards';
import { STATUS_LABELS } from '@/lib/orders/status';

export default async function AdminOrdersPage({ searchParams }: { searchParams: { q?: string } }) {
  const { supabase } = await requireAdmin();

  let query = supabase
    .from('orders')
    .select('id, order_number, status, payment_method, payment_status, grand_total, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (searchParams.q) query = query.ilike('order_number', `%${searchParams.q}%`);

  const { data: orders } = await query;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Orders</h1>

      <form className="mb-4">
        <input
          name="q"
          placeholder="Search order number…"
          defaultValue={searchParams.q}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-64"
        />
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2">Order</th>
            <th className="py-2">Total</th>
            <th className="py-2">Payment</th>
            <th className="py-2">Status</th>
            <th className="py-2">Placed</th>
          </tr>
        </thead>
        <tbody>
          {(orders ?? []).map((order) => (
            <tr key={order.id} className="border-b border-gray-100">
              <td className="py-3">
                <Link href={`/admin/orders/${order.id}`} className="text-brand font-medium">{order.order_number}</Link>
              </td>
              <td className="py-3">₹{order.grand_total}</td>
              <td className="py-3 capitalize">{order.payment_method} · {order.payment_status}</td>
              <td className="py-3">{STATUS_LABELS[order.status] ?? order.status}</td>
              <td className="py-3 text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {(orders ?? []).length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-gray-500">No orders yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
