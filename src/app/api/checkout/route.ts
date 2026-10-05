import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getOrCreateCartId } from '@/lib/cart/get-or-create-cart';

const checkoutSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  line1: z.string().min(5),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  coupon_code: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to check out.' }, { status: 401 });
  }

  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const cartId = await getOrCreateCartId(supabase, user.id);

  const { data: orderId, error } = await supabase.rpc('checkout_cart', {
    p_cart_id: cartId,
    p_profile_id: user.id,
    p_guest_email: null,
    p_guest_phone: null,
    p_shipping_address: {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      line1: parsed.data.line1,
      line2: parsed.data.line2,
      city: parsed.data.city,
      state: parsed.data.state,
      pincode: parsed.data.pincode,
    },
    p_payment_method: 'cod',
    p_coupon_code: parsed.data.coupon_code || null,
  });

  if (error) {
    // Surface known business errors in plain language; everything else stays generic.
    const known: Record<string, string> = {
      EMPTY_CART: 'Your cart is empty.',
      PRODUCT_NOT_AVAILABLE: 'One of the items in your cart is no longer available.',
      INSUFFICIENT_STOCK: 'One of the items in your cart just went out of stock. Please review your cart.',
      INVALID_COUPON: 'That coupon code is not valid.',
      COUPON_LIMIT_REACHED: 'That coupon has reached its usage limit.',
      COUPON_ALREADY_USED: "You've already used that coupon.",
      COUPON_MIN_ORDER_NOT_MET: 'Your order doesn\'t meet the minimum for that coupon.',
      COUPON_NOT_APPLICABLE: "That coupon doesn't apply to anything in your cart.",
    };
    const message = Object.keys(known).find((key) => error.message.includes(key));
    return NextResponse.json({ error: message ? known[message] : 'Could not place your order. Please try again.' }, { status: 409 });
  }

  return NextResponse.json({ order_id: orderId }, { status: 201 });
}
