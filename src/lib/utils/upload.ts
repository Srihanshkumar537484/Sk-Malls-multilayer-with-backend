import { createClient } from '@/lib/supabase/client';

const BUCKET = 'product-images';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Uploads a batch of image files to the `product-images` Storage bucket
 * (create it once in the Supabase dashboard: Storage > New bucket > Public)
 * and returns their public URLs. Validates type/size client-side; the
 * bucket should also be configured with a file-size limit server-side.
 */
export async function uploadProductImages(files: File[], sellerId: string): Promise<string[]> {
  const supabase = createClient();
  const urls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`${file.name}: only JPEG, PNG, or WebP images are allowed.`);
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(`${file.name}: images must be under 5MB.`);
    }

    const ext = file.name.split('.').pop();
    const path = `${sellerId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      throw new Error(`Failed to upload ${file.name}: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}
