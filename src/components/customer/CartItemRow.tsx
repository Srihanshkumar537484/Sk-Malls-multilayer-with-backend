'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CartItemRow({
  id,
  name,
  size,
  color,
  price,
  quantity,
  maxStock,
}: {
  id: string;
  name: string;
  size: string | null;
  color: string | null;
  price: number;
  quantity: number;
  maxStock: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function updateQuantity(newQty: number) {
    setBusy(true);
    await fetch('/api/cart', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_item_id: id, quantity: newQty }),
    });
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    await fetch('/api/cart', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_item_id: id }),
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-100">
      <div className="h-16 w-16 rounded-md bg-gray-100 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">
          {[size, color].filter(Boolean).join(' / ')}
        </p>
        <p className="text-sm font-semibold mt-1">₹{price}</p>
      </div>
      <input
        type="number"
        min={1}
        max={maxStock}
        defaultValue={quantity}
        disabled={busy}
        onBlur={(e) => updateQuantity(Number(e.target.value))}
        className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <button type="button" onClick={remove} disabled={busy} className="text-sm text-red-600">
        Remove
      </button>
    </div>
  );
}
