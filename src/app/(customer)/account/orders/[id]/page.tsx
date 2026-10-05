import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { RequestReturnButton } from '@/components/customer/RequestReturnButton';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, payment_method, payment_status, grand_total, discount_total, coupon_code, shipping_address, created_at,
       seller_orders ( id, sub_order_number, subtotal, status, sellers ( business_name ),
         order_items ( id, product_name_snapshot, size, color, quantity, unit_price ) )`
    )
    .eq('id', params.id)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold mb-1">Order placed 🎉</h1>
      <p className="text-gray-600 mb-8">
        Order <strong>{order.order_number}</strong> — pay ₹{order.grand_total} on delivery.
        {order.discount_total > 0 && (
          <span className="block text-sm text-green-700">
            Coupon {order.coupon_code} saved you ₹{order.discount_total}.
          </span>
        )}
      </p>

      {(order.seller_orders ?? []).map((so: any) => (
        <div key={so.id} className="rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold">{so.sellers?.business_name}</span>
            <span className="text-gray-500">{so.sub_order_number} · {so.status}</span>
          </div>
          {(so.order_items ?? []).map((item: any) => (
            <div key={item.id} className="flex justify-between items-center text-sm py-1">
              <span>
                {item.product_name_snapshot} {[item.size, item.color].filter(Boolean).join(' / ')} × {item.quantity}
              </span>
              <div className="flex items-center gap-3">
                <span>₹{(item.unit_price * item.quantity).toFixed(2)}</span>
                {so.status === 'delivered' && <RequestReturnButton orderItemId={item.id} />}
              </div>
            </div>
          ))}
        </div>
      ))}

      <Link href="/shop" className="text-brand font-medium">Continue shopping →</Link>
    </div>
  );
}
