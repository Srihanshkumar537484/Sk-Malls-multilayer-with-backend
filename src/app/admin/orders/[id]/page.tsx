import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/guards';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { ADMIN_ALL_STATUSES } from '@/lib/orders/status';

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, payment_method, payment_status, grand_total, shipping_address, created_at,
       seller_orders ( id, sub_order_number, subtotal, commission_amount, seller_net_amount, status,
         sellers ( business_name ),
         order_items ( product_name_snapshot, size, color, quantity, unit_price ) )`
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!order) notFound();
  const address = order.shipping_address as any;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">{order.order_number}</h1>
      <p className="text-sm text-gray-600 mb-6">
        ₹{order.grand_total} · {order.payment_method.toUpperCase()} ({order.payment_status}) · placed{' '}
        {new Date(order.created_at).toLocaleString()}
      </p>

      <div className="rounded-lg border border-gray-200 p-4 mb-6 text-sm">
        <p className="font-semibold text-gray-900 mb-1">Shipping to</p>
        <p>{address.full_name} · {address.phone}</p>
        <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
        <p>{address.city}, {address.state} {address.pincode}</p>
      </div>

      {(order.seller_orders ?? []).map((so: any) => (
        <div key={so.id} className="rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-sm">{so.sellers?.business_name}</p>
              <p className="text-xs text-gray-500">{so.sub_order_number}</p>
            </div>
            <OrderStatusSelect
              endpoint={`/api/admin/orders/${so.id}/status`}
              currentStatus={so.status}
              options={ADMIN_ALL_STATUSES.filter((s) => s !== so.status)}
            />
          </div>

          {(so.order_items ?? []).map((item: any, i: number) => (
            <p key={i} className="flex justify-between text-sm py-1">
              <span>{item.product_name_snapshot} {[item.size, item.color].filter(Boolean).join(' / ')} × {item.quantity}</span>
              <span>₹{(item.unit_price * item.quantity).toFixed(2)}</span>
            </p>
          ))}

          <div className="border-t border-gray-100 mt-2 pt-2 text-xs text-gray-600 flex gap-4">
            <span>Subtotal: ₹{so.subtotal}</span>
            <span>Commission: ₹{so.commission_amount}</span>
            <span>Seller net: ₹{so.seller_net_amount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
