import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  product_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in to leave a review.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify this order_item really belongs to this user, is for this
  // product, and the sub-order was actually delivered — "verified
  // purchase" per spec section 35 is enforced here, not just labelled.
  const { data: item } = await supabase
    .from('order_items')
    .select('id, product_id, seller_order_id, seller_orders ( status, orders ( profile_id ) )')
    .eq('id', parsed.data.order_item_id)
    .maybeSingle();

  const subOrder = (item as any)?.seller_orders;
  const orderProfileId = subOrder?.orders?.profile_id;

  if (
    !item ||
    item.product_id !== parsed.data.product_id ||
    orderProfileId !== user.id ||
    subOrder?.status !== 'delivered'
  ) {
    return NextResponse.json(
      { error: 'You can only review products from your own delivered orders.' },
      { status: 403 }
    );
  }

  const { error } = await supabase.from('reviews').insert({
    product_id: parsed.data.product_id,
    profile_id: user.id,
    order_item_id: parsed.data.order_item_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    is_verified_purchase: true,
    is_approved: false, // admin moderation required, per spec section 35
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You already reviewed this item.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
