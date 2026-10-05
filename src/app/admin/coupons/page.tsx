import { requireAdmin } from '@/lib/auth/guards';
import { CreateCouponForm } from '@/components/admin/CreateCouponForm';
import { CouponToggle } from '@/components/admin/CouponToggle';

export default async function AdminCouponsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: coupons }, { data: sellers }, { data: categories }] = await Promise.all([
    supabase.from('coupons').select('id, code, scope, discount_type, discount_value, times_used, usage_limit, is_active').order('created_at', { ascending: false }),
    supabase.from('sellers').select('id, business_name').eq('status', 'approved'),
    supabase.from('categories').select('id, name').eq('is_active', true),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Coupons</h1>

      <div className="mb-8">
        <CreateCouponForm
          sellers={(sellers ?? []).map((s) => ({ id: s.id, label: s.business_name }))}
          categories={(categories ?? []).map((c) => ({ id: c.id, label: c.name }))}
        />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2">Code</th>
            <th className="py-2">Scope</th>
            <th className="py-2">Discount</th>
            <th className="py-2">Used</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(coupons ?? []).map((coupon) => (
            <tr key={coupon.id} className="border-b border-gray-100">
              <td className="py-3 font-mono">{coupon.code}</td>
              <td className="py-3 capitalize">{coupon.scope}</td>
              <td className="py-3">
                {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}
              </td>
              <td className="py-3">{coupon.times_used}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}</td>
              <td className="py-3"><CouponToggle id={coupon.id} isActive={coupon.is_active} /></td>
            </tr>
          ))}
          {(coupons ?? []).length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-gray-500">No coupons yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
