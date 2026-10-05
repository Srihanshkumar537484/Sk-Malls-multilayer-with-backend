import { notFound } from 'next/navigation';
import { requireApprovedSeller } from '@/lib/auth/guards';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { ReturnReviewButtons } from '@/components/admin/ReturnReviewButtons';
import { SELLER_ALLOWED_TRANSITIONS } from '@/lib/orders/status';

export default async function SellerOrderDetailPage({ params }: { params: { id: string } }) {
  const { supabase, seller } = await requireApprovedSeller();

  const { data: subOrder } = await supabase
    .from('seller_orders')
    .select(
      `id, sub_order_number, subtotal, commission_amount, seller_net_amount, status, seller_id,
       orders ( order_number, shipping_address ),
       order_items ( id, product_name_snapshot, size, color, quantity, unit_price ),
       returns ( id, reason, status )`
    )
    .eq('id', params.id)
    .maybeSingle();

  // RLS already prevents reading another seller's sub-order, but this
  // confirms it explicitly and gives a clean 404 either way.
  if (!subOrder || subOrder.seller_id !== seller.id) notFound();

  const address = (subOrder.orders as any)?.shipping_address;
  const allowed = SELLER_ALLOWED_TRANSITIONS[subOrder.status] ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">{subOrder.sub_order_number}</h1>
      <p className="text-sm text-gray-600 mb-6">Part of {(subOrder.orders as any)?.order_number}</p>

      <div className="rounded-lg border border-gray-200 p-4 mb-6 text-sm">
        <p className="font-semibold text-gray-900 mb-1">Deliver to</p>
        <p>{address.full_name} · {address.phone}</p>
        <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
        <p>{address.city}, {address.state} {address.pincode}</p>
      </div>

      {(subOrder.returns ?? []).filter((r: any) => r.status === 'requested').length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 mb-6">
          <p className="font-semibold text-sm text-gray-900 mb-2">Return requested</p>
          {(subOrder.returns ?? [])
            .filter((r: any) => r.status === 'requested')
            .map((r: any) => (
              <div key={r.id} className="flex items-center justify-between">
                <p className="text-sm text-gray-700">Reason: {r.reason}</p>
                <ReturnReviewButtons returnId={r.id} />
              </div>
            ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Fulfillment status</p>
          <OrderStatusSelect
            endpoint={`/api/seller/orders/${subOrder.id}/status`}
            currentStatus={subOrder.status}
            options={allowed}
          />
        </div>

        {(subOrder.order_items ?? []).map((item: any, i: number) => (
          <p key={i} className="flex justify-between text-sm py-1">
            <span>{item.product_name_snapshot} {[item.size, item.color].filter(Boolean).join(' / ')} × {item.quantity}</span>
            <span>₹{(item.unit_price * item.quantity).toFixed(2)}</span>
          </p>
        ))}

        <div className="border-t border-gray-100 mt-2 pt-2 text-xs text-gray-600 flex gap-4">
          <span>Subtotal: ₹{subOrder.subtotal}</span>
          <span>Commission: ₹{subOrder.commission_amount}</span>
          <span>Your net: ₹{subOrder.seller_net_amount}</span>
        </div>
      </div>
    </div>
  );
}
