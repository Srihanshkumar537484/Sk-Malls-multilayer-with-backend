import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function SellerDashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, business_name, status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!seller) redirect('/seller/register');

  const [{ count: productCount }, { count: orderCount }, { data: ledgerRows }] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', seller.id),
    supabase.from('seller_orders').select('id', { count: 'exact', head: true }).eq('seller_id', seller.id),
    supabase.from('seller_ledger').select('type, amount, status').eq('seller_id', seller.id),
  ]);

  const pendingEarnings = (ledgerRows ?? [])
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const availableEarnings = (ledgerRows ?? [])
    .filter((r) => r.status === 'posted')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">{seller.business_name}</h1>
      <p className="text-sm text-gray-600 mb-6">
        Status: <span className="font-medium capitalize">{seller.status}</span>
        {seller.status === 'pending' && ' — an admin needs to approve your account before you can list products.'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Products" value={productCount ?? 0} />
        <Stat label="Orders" value={orderCount ?? 0} />
        <Stat label="Pending earnings" value={`₹${pendingEarnings.toFixed(2)}`} />
        <Stat label="Available earnings" value={`₹${availableEarnings.toFixed(2)}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-2xl font-bold text-brand">{value}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
    </div>
  );
}
