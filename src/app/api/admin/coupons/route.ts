import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  code: z.string().min(3).transform((s) => s.toUpperCase()),
  scope: z.enum(['platform', 'seller', 'category', 'product']),
  seller_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.coerce.number().positive(),
  min_order_value: z.coerce.number().min(0).default(0),
  max_discount_amount: z.coerce.number().positive().optional(),
  usage_limit: z.coerce.number().int().positive().optional(),
  per_user_limit: z.coerce.number().int().positive().default(1),
  expires_at: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { scope, seller_id, category_id, product_id } = parsed.data;
  if (scope === 'seller' && !seller_id) return NextResponse.json({ error: 'seller_id is required for a seller coupon.' }, { status: 400 });
  if (scope === 'category' && !category_id) return NextResponse.json({ error: 'category_id is required for a category coupon.' }, { status: 400 });
  if (scope === 'product' && !product_id) return NextResponse.json({ error: 'product_id is required for a product coupon.' }, { status: 400 });

  const { data: coupon, error } = await supabase
    .from('coupons')
    .insert({
      ...parsed.data,
      seller_id: scope === 'seller' ? seller_id : null,
      category_id: scope === 'category' ? category_id : null,
      product_id: scope === 'product' ? product_id : null,
    })
    .select('id, code')
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A coupon with this code already exists.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ coupon }, { status: 201 });
}
