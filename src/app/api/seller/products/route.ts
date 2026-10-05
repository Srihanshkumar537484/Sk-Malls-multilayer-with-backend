import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { productSchema } from '@/lib/validation/product';
import { slugify, withUniqueSuffix } from '@/lib/utils/slug';

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });
  }

  // Resolve the caller's seller record — this also confirms they ARE a
  // seller, and RLS backs this up independently at the DB layer.
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, status, is_owner_store')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!seller) {
    return NextResponse.json({ error: 'No seller account found for this user.' }, { status: 403 });
  }
  if (seller.status !== 'approved') {
    return NextResponse.json(
      { error: `Your seller account is ${seller.status}. Approved sellers only can add products.` },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { image_urls, variants, tags, ...productFields } = parsed.data;

  const baseSlug = slugify(productFields.name);
  let slug = baseSlug;

  // Per spec section 13: seller products go to admin approval; the mall
  // owner's own store publishes directly. Never let the client set status.
  const status = seller.is_owner_store ? 'approved' : 'pending_approval';

  let attempt = 0;
  let productId: string | null = null;
  let insertError: string | null = null;

  // Retry once on slug collision rather than failing the whole submission.
  while (attempt < 2 && !productId) {
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        seller_id: seller.id,
        slug,
        status,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        ...productFields,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505' && attempt === 0) {
        slug = withUniqueSuffix(baseSlug);
        attempt += 1;
        continue;
      }
      insertError = error.message;
      break;
    }
    productId = product.id;
  }

  if (!productId) {
    return NextResponse.json({ error: insertError ?? 'Could not create product.' }, { status: 500 });
  }

  // Images
  const imageRows = image_urls.map((url, index) => ({
    product_id: productId,
    url,
    sort_order: index,
  }));
  const { error: imagesError } = await supabase.from('product_images').insert(imageRows);
  if (imagesError) {
    return NextResponse.json({ error: `Product created but images failed: ${imagesError.message}` }, { status: 500 });
  }

  // Variants + their inventory rows
  for (const variant of variants) {
    const { data: variantRow, error: variantError } = await supabase
      .from('product_variants')
      .insert({
        product_id: productId,
        size: variant.size || null,
        color: variant.color || null,
      })
      .select('id')
      .single();

    if (variantError) {
      return NextResponse.json(
        { error: `Product created but a variant failed: ${variantError.message}` },
        { status: 500 }
      );
    }

    const { error: inventoryError } = await supabase
      .from('inventory')
      .insert({ variant_id: variantRow.id, quantity: variant.stock });

    if (inventoryError) {
      return NextResponse.json(
        { error: `Product created but stock failed to save: ${inventoryError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ id: productId, slug, status }, { status: 201 });
}
