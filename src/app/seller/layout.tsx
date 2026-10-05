import Link from 'next/link';

const SELLER_NAV = [
  { href: '/seller/dashboard', label: 'Dashboard' },
  { href: '/seller/products', label: 'Products' },
  { href: '/seller/orders', label: 'Orders' },
  { href: '/seller/earnings', label: 'Earnings' },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
        <p className="font-display font-bold text-brand mb-6">Seller Portal</p>
        <nav className="space-y-1 text-sm">
          {SELLER_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-gray-700 hover:bg-white hover:text-brand">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
