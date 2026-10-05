import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  order_item_id: z.string().uuid(),
  reason: z.string().min(3, 'Tell us why you want to return this item.'),
});

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: returnId, error } = await supabase.rpc('request_return', {
    p_order_item_id: parsed.data.order_item_id,
    p_reason: parsed.data.reason,
  });

  if (error) {
    const known: Record<string, string> = {
      ORDER_ITEM_NOT_FOUND: 'Order item not found.',
      NOT_YOUR_ORDER: 'This is not your order.',
      ORDER_NOT_DELIVERED: 'You can only request a return after the item is delivered.',
      RETURN_ALREADY_REQUESTED: 'You already requested a return for this item.',
    };
    const message = Object.keys(known).find((key) => error.message.includes(key));
    return NextResponse.json({ error: message ? known[message] : 'Could not request a return.' }, { status: 409 });
  }

  return NextResponse.json({ id: returnId }, { status: 201 });
}
