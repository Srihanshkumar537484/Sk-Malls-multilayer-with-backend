import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CartItemRow } from '@/components/customer/CartItemRow';

export default async function CartPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/cart');

  const { data: cart } = await supabase.from('carts').select('id').eq('profile_id', user.id).maybeSingle();

  const { data: items } = cart
    ? await supabase
        .from('cart_items')
        .select(
          `id, quantity, seller_id,
           products ( name, selling_price ),
           product_variants ( size, color, inventory ( quantity ) ),
           sellers ( business_name )`
        )
        .eq('cart_id', cart.id)
    : { data: [] as any[] };

  const rows = (items ?? []).map((item: any) => ({
    id: item.id,
    sellerId: item.seller_id,
    sellerName: item.sellers?.business_name ?? 'Seller',
    name: item.products?.name ?? '',
    price: item.products?.selling_price ?? 0,
    size: item.product_variants?.size ?? null,
    color: item.product_variants?.color ?? null,
    quantity: item.quantity,
    maxStock: item.product_variants?.inventory?.[0]?.quantity ?? item.product_variants?.inventory?.quantity ?? item.quantity,
  }));

  const bySeller = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    (acc[row.sellerId] ??= []).push(row);
    return acc;
  }, {});

  const grandTotal = rows.reduce((sum, row) => sum + row.price * row.quantity, 0);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Your cart is empty</h1>
        <Link href="/shop" className="text-brand font-medium">Continue shopping →</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold mb-6">Your cart</h1>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {Object.entries(bySeller).map(([sellerId, sellerRows]) => (
            <div key={sellerId}>
              <p className="text-sm font-semibold text-gray-900 mb-2">{sellerRows[0].sellerName}</p>
              {sellerRows.map((row) => (
                <CartItemRow
                  key={row.id}
                  id={row.id}
                  name={row.name}
                  size={row.size}
                  color={row.color}
                  price={row.price}
                  quantity={row.quantity}
                  maxStock={row.maxStock}
                />
              ))}
              <p className="text-sm text-gray-600 mt-2">
                Subtotal ({sellerRows[0].sellerName}): ₹
                {sellerRows.reduce((s, r) => s + r.price * r.quantity, 0).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 p-4 h-fit">
          <p className="flex justify-between text-sm mb-2">
            <span>Items ({rows.reduce((s, r) => s + r.quantity, 0)})</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </p>
          <p className="text-xs text-gray-500 mb-4">Shipping is calculated at checkout.</p>
          <Link
            href="/checkout"
            className="block text-center rounded-full bg-brand px-6 py-3 font-semibold text-white"
          >
            Proceed to checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
