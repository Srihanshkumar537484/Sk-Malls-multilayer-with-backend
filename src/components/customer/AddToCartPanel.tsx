'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Variant = {
  id: string;
  size: string | null;
  color: string | null;
  stock: number;
};

export function AddToCartPanel({
  productId,
  sellerId,
  variants,
}: {
  productId: string;
  sellerId: string;
  variants: Variant[];
}) {
  const router = useRouter();
  const sizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))), [variants]);
  const colors = useMemo(() => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))), [variants]);

  const [selectedSize, setSelectedSize] = useState<string | null>(sizes[0] ?? null);
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'error' | 'added'>('idle');
  const [error, setError] = useState<string | null>(null);

  const matchedVariant = variants.find(
    (v) => (sizes.length === 0 || v.size === selectedSize) && (colors.length === 0 || v.color === selectedColor)
  );
  const inStock = (matchedVariant?.stock ?? 0) > 0;

  async function handleAddToCart() {
    if (!matchedVariant) return;
    setStatus('adding');
    setError(null);

    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        variant_id: matchedVariant.id,
        seller_id: sellerId,
        quantity,
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setStatus('error');
      setError(typeof body.error === 'string' ? body.error : 'Could not add to cart.');
      return;
    }

    setStatus('added');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {sizes.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  selectedSize === size ? 'border-brand text-brand font-medium' : 'border-gray-300 text-gray-700'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  selectedColor === color ? 'border-brand text-brand font-medium' : 'border-gray-300 text-gray-700'
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium text-gray-700">Qty</label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={Math.max(1, matchedVariant?.stock ?? 1)}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      {!inStock && matchedVariant && (
        <p className="text-sm text-red-600">Out of stock for this size/color.</p>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {status === 'added' && <p className="text-sm text-green-700">Added to cart.</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!inStock || status === 'adding'}
          className="rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {status === 'adding' ? 'Adding…' : 'Add to cart'}
        </button>
        <a
          href="/checkout"
          onClick={(e) => {
            if (status !== 'added') e.preventDefault();
          }}
          className="rounded-full border border-brand px-6 py-3 font-semibold text-brand"
        >
          Buy now
        </a>
      </div>
    </div>
  );
}
