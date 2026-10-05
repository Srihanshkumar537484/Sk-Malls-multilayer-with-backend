/**
 * Allowed forward transitions for a seller_orders.status. Fulfillment
 * status lives on the seller sub-order (spec section 24/32) — each seller
 * only ever moves their own sub-order through this pipeline.
 * Admin can additionally force any transition (see requireAdmin check in
 * the API route) — this map is what SELLERS are restricted to.
 */
export const SELLER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
  return_requested: ['returned'], // seller approving a return moves it here; rejection handled via /returns
  returned: ['refund_pending'],
  refund_pending: [],
  refunded: [],
};

export const ADMIN_ALL_STATUSES = [
  'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery',
  'delivered', 'cancelled', 'return_requested', 'returned', 'refund_pending', 'refunded',
];

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  returned: 'Returned',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};
