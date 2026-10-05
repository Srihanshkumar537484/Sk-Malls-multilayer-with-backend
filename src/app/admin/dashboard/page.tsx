import { createServerSupabaseClient } from '@/lib/supabase/server';

async function count(table: string, filter?: Record<string, string>) {
  const supabase = createServerSupabaseClient();
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filter) {
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value);
    }
  }
  const { count: total } = await query;
  return total ?? 0;
}

export default async function AdminDashboardPage() {
  const [pendingSellers, pendingProducts, orders, sellers] = await Promise.all([
    count('sellers', { status: 'pending' }),
    count('products', { status: 'pending_approval' }),
    count('orders'),
    count('sellers', { status: 'approved' }),
  ]);

  const stats = [
    { label: 'Pending seller approvals', value: pendingSellers, href: '/admin/sellers' },
    { label: 'Pending product approvals', value: pendingProducts, href: '/admin/products' },
    { label: 'Total orders', value: orders, href: '/admin/orders' },
    { label: 'Active sellers', value: sellers, href: '/admin/sellers' },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 p-4">
            <p className="text-3xl font-bold text-brand">{stat.value}</p>
            <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
