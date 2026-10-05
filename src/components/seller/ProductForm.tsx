'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadProductImages } from '@/lib/utils/upload';

type Category = { id: string; name: string };
type VariantRow = { size: string; color: string; stock: string };

export function ProductForm({ sellerId, categories }: { sellerId: string; categories: Category[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([{ size: '', color: '', stock: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addVariantRow() {
    setVariants((rows) => [...rows, { size: '', color: '', stock: '' }]);
  }
  function removeVariantRow(index: number) {
    setVariants((rows) => rows.filter((_, i) => i !== index));
  }
  function updateVariantRow(index: number, field: keyof VariantRow, value: string) {
    setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (files.length === 0) {
        throw new Error('Upload at least one product photo.');
      }

      const imageUrls = await uploadProductImages(files, sellerId);

      const formData = new FormData(event.currentTarget);
      const payload = {
        name: formData.get('name'),
        category_id: formData.get('category_id'),
        brand: formData.get('brand') || undefined,
        mrp: formData.get('mrp'),
        selling_price: formData.get('selling_price'),
        description: formData.get('description'),
        fabric: formData.get('fabric') || undefined,
        fit: formData.get('fit') || undefined,
        weight_grams: formData.get('weight_grams') || undefined,
        tags: formData.get('tags') || undefined,
        shipping_note: formData.get('shipping_note') || undefined,
        return_note: formData.get('return_note') || undefined,
        image_urls: imageUrls,
        variants: variants.map((v) => ({ size: v.size || undefined, color: v.color || undefined, stock: v.stock })),
      };

      const res = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(typeof body.error === 'string' ? body.error : 'Please check the form and try again.');
      }

      router.push('/seller/products');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Photos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product photos</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP, up to 5MB each.</p>
      </div>

      {/* Basics */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Product name</label>
        <input id="name" name="name" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select id="category_id" name="category_id" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">Brand (optional)</label>
        <input id="brand" name="brand" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="mrp" className="block text-sm font-medium text-gray-700 mb-1">MRP (₹)</label>
          <input id="mrp" name="mrp" type="number" step="0.01" min="0" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="selling_price" className="block text-sm font-medium text-gray-700 mb-1">Selling price (₹)</label>
          <input id="selling_price" name="selling_price" type="number" step="0.01" min="0" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <p className="text-xs text-gray-500 mt-1">Discount is shown automatically from MRP vs. selling price.</p>
        </div>
      </div>

      {/* Variants: size / color / size-wise stock */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Sizes, colors & stock</label>
        <div className="space-y-2">
          {variants.map((row, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                placeholder="Size (e.g. M)"
                value={row.size}
                onChange={(e) => updateVariantRow(index, 'size', e.target.value)}
                className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Color (e.g. Black)"
                value={row.color}
                onChange={(e) => updateVariantRow(index, 'color', e.target.value)}
                className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Stock"
                type="number"
                min="0"
                required
                value={row.stock}
                onChange={(e) => updateVariantRow(index, 'stock', e.target.value)}
                className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              {variants.length > 1 && (
                <button type="button" onClick={() => removeVariantRow(index)} className="text-sm text-red-600">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addVariantRow} className="mt-2 text-sm text-brand font-medium">
          + Add another size/color
        </button>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea id="description" name="description" rows={4} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fabric" className="block text-sm font-medium text-gray-700 mb-1">Fabric (optional)</label>
          <input id="fabric" name="fabric" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="fit" className="block text-sm font-medium text-gray-700 mb-1">Fit (optional)</label>
          <input id="fit" name="fit" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label htmlFor="weight_grams" className="block text-sm font-medium text-gray-700 mb-1">Weight in grams (optional)</label>
        <input id="weight_grams" name="weight_grams" type="number" min="0" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated, optional)</label>
        <input id="tags" name="tags" placeholder="summer, cotton, casual" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {/* Shipping / return info */}
      <div>
        <label htmlFor="shipping_note" className="block text-sm font-medium text-gray-700 mb-1">Shipping information</label>
        <textarea id="shipping_note" name="shipping_note" rows={2} placeholder="e.g. Ships in 2-3 business days" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="return_note" className="block text-sm font-medium text-gray-700 mb-1">Return information</label>
        <textarea id="return_note" name="return_note" rows={2} placeholder="e.g. 7-day easy returns" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60">
        {submitting ? 'Publishing…' : 'Save & submit for approval'}
      </button>
    </form>
  );
}
