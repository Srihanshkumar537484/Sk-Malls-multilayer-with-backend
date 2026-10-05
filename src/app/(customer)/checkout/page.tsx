import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CheckoutForm } from '@/components/customer/CheckoutForm';

export default async function CheckoutPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/checkout');

  const { data: cart } = await supabase.from('carts').select('id').eq('profile_id', user.id).maybeSingle();
  const { data: items } = cart
    ? await supabase
        .from('cart_items')
        .select('id, quantity, products ( name, selling_price )')
        .eq('cart_id', cart.id)
    : { data: [] as any[] };

  if (!items || items.length === 0) redirect('/cart');

  const total = items.reduce((sum: number, item: any) => sum + item.products.selling_price * item.quantity, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold mb-6">Checkout</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <h2 className="font-semibold text-sm text-gray-900 mb-3">Shipping address</h2>
          <CheckoutForm />
        </div>
        <div className="rounded-lg border border-gray-200 p-4 h-fit">
          <h2 className="font-semibold text-sm text-gray-900 mb-3">Order summary</h2>
          {items.map((item: any) => (
            <p key={item.id} className="flex justify-between text-sm py-1">
              <span className="truncate pr-2">{item.products.name} × {item.quantity}</span>
              <span>₹{(item.products.selling_price * item.quantity).toFixed(2)}</span>
            </p>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold text-sm">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
