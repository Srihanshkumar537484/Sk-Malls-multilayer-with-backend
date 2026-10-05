import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AddToCartPanel } from '@/components/customer/AddToCartPanel';
import { ReviewForm } from '@/components/customer/ReviewForm';

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabaseClient();

  const { data: product } = await supabase
    .from('products')
    .select(
      `id, name, description, mrp, selling_price, brand, shipping_note, return_note, seller_id,
       sellers ( id, business_name, stores ( slug, name ) ),
       product_images ( url, sort_order ),
       product_variants ( id, size, color, inventory ( quantity ) )`
    )
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (!product) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: approvedReviews } = await supabase
    .from('reviews')
    .select('rating, comment, is_verified_purchase, created_at, profiles ( full_name )')
    .eq('product_id', product.id)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  // Eligibility for leaving a review: a delivered order_item for this
  // product, belonging to this user, not already reviewed.
  let eligibleOrderItemId: string | null = null;
  if (user) {
    const { data: deliveredItems } = await supabase
      .from('order_items')
      .select('id, seller_orders!inner ( status, orders!inner ( profile_id ) )')
      .eq('product_id', product.id)
      .eq('seller_orders.status', 'delivered')
      .eq('seller_orders.orders.profile_id', user.id);

    const { data: alreadyReviewed } = await supabase
      .from('reviews')
      .select('order_item_id')
      .eq('product_id', product.id)
      .eq('profile_id', user.id);

    const reviewedIds = new Set((alreadyReviewed ?? []).map((r) => r.order_item_id));
    eligibleOrderItemId = (deliveredItems ?? []).find((item: any) => !reviewedIds.has(item.id))?.id ?? null;
  }

  const images = (product.product_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const variants = (product.product_variants ?? []).map((v: any) => ({
    id: v.id,
    size: v.size,
    color: v.color,
    stock: v.inventory?.[0]?.quantity ?? v.inventory?.quantity ?? 0,
  }));
  const seller = product.sellers as any;
  const store = seller?.stores?.[0] ?? seller?.stores;
  const discountPct = product.mrp > 0 ? Math.round((1 - product.selling_price / product.mrp) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square rounded-lg bg-gray-100 mb-3" />
          <div className="grid grid-cols-4 gap-2">
            {images.slice(0, 4).map((img: any, i: number) => (
              <div key={i} className="aspect-square rounded-md bg-gray-100" />
            ))}
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold">{product.name}</h1>
          {store && (
            <Link href={`/store/${store.slug}`} className="text-sm text-brand mt-1 inline-block">
              Sold by {seller.business_name}
            </Link>
          )}

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold">₹{product.selling_price}</span>
            {product.mrp > product.selling_price && (
              <>
                <span className="text-gray-400 line-through">₹{product.mrp}</span>
                <span className="text-green-700 text-sm font-medium">{discountPct}% off</span>
              </>
            )}
          </div>

          <div className="mt-6">
            <AddToCartPanel productId={product.id} sellerId={product.seller_id} variants={variants} />
          </div>

          <div className="mt-8 space-y-4 text-sm">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Description</h2>
              <p className="text-gray-700 whitespace-pre-line">{product.description}</p>
            </div>
            {product.shipping_note && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">Shipping</h2>
                <p className="text-gray-700">{product.shipping_note}</p>
              </div>
            )}
            {product.return_note && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">Returns</h2>
                <p className="text-gray-700">{product.return_note}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 max-w-2xl">
        <h2 className="font-display text-xl font-semibold mb-4">Reviews</h2>

        {eligibleOrderItemId && (
          <div className="mb-6">
            <ReviewForm productId={product.id} orderItemId={eligibleOrderItemId} />
          </div>
        )}

        {(approvedReviews ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {(approvedReviews ?? []).map((review: any, i: number) => (
              <div key={i} className="border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  <span className="text-xs text-gray-500">{review.profiles?.full_name ?? 'Customer'}</span>
                  {review.is_verified_purchase && (
                    <span className="text-xs text-green-700">Verified purchase</span>
                  )}
                </div>
                {review.comment && <p className="text-sm text-gray-700">{review.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
