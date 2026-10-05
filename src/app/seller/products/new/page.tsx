import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProductForm } from '@/components/seller/ProductForm';

export default async function NewProductPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!seller) redirect('/seller/register');
  if (seller.status !== 'approved') {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold mb-2">Add product</h1>
        <p className="text-gray-600">
          Your seller account is <strong>{seller.status}</strong>. You can add products once an admin approves your account.
        </p>
      </div>
    );
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Add product</h1>
      <ProductForm sellerId={seller.id} categories={categories ?? []} />
    </div>
  );
}
