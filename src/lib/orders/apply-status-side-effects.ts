import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Applies the side effects of a seller_order status change:
 *  - on cancellation: restock every item's inventory
 *  - on delivery: move that sub-order's ledger entries from 'pending' to
 *    'posted' (this is what makes earnings "available" per spec section 28)
 * Called after the status column itself has already been updated.
 */
export async function applyOrderStatusSideEffects(
  supabase: SupabaseClient,
  sellerOrderId: string,
  newStatus: string
) {
  if (newStatus === 'cancelled') {
    const { data: items } = await supabase
      .from('order_items')
      .select('variant_id, quantity')
      .eq('seller_order_id', sellerOrderId);

    for (const item of items ?? []) {
      await supabase.rpc('restock', { p_variant_id: item.variant_id, p_qty: item.quantity });
    }

    await supabase
      .from('seller_ledger')
      .update({ status: 'reversed' })
      .eq('seller_order_id', sellerOrderId)
      .eq('status', 'pending');
  }

  if (newStatus === 'delivered') {
    await supabase
      .from('seller_ledger')
      .update({ status: 'posted' })
      .eq('seller_order_id', sellerOrderId)
      .eq('status', 'pending');
  }
}
