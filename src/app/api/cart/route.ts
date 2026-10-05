import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getOrCreateCartId } from '@/lib/cart/get-or-create-cart';

const addItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20),
});

const updateItemSchema = z.object({
  cart_item_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20),
});

const removeItemSchema = z.object({
  cart_item_id: z.string().uuid(),
});

async function requireUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in to add items to your cart.' }, { status: 401 });

  const parsed = addItemSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { product_id, variant_id, seller_id, quantity } = parsed.data;

  // Re-check stock server-side before even adding to cart — final authority
  // is still checkout_cart(), but this avoids letting an obviously-oversold
  // quantity sit in the cart.
  const { data: inventory } = await supabase.from('inventory').select('quantity').eq('variant_id', variant_id).maybeSingle();
  if (!inventory || inventory.quantity < quantity) {
    return NextResponse.json({ error: 'Not enough stock available for that quantity.' }, { status: 409 });
  }

  const cartId = await getOrCreateCartId(supabase, user.id);

  // If this variant is already in the cart, bump the quantity instead of a duplicate row
  const { data: existingItem } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('variant_id', variant_id)
    .maybeSingle();

  if (existingItem) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existingItem.quantity + quantity })
      .eq('id', existingItem.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from('cart_items')
    .insert({ cart_id: cartId, product_id, variant_id, seller_id, quantity });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });

  const parsed = updateItemSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // RLS (cart_items_own) already scopes this update to the caller's own cart.
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity: parsed.data.quantity })
    .eq('id', parsed.data.cart_item_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });

  const parsed = removeItemSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error } = await supabase.from('cart_items').delete().eq('id', parsed.data.cart_item_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
