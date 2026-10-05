import Link from 'next/link';

const NAV_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/shop#categories', label: 'Categories' },
  { href: '/stores', label: 'Stores' },
  { href: '/shop?deals=1', label: 'Deals' },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/" className="font-display text-xl font-bold text-brand shrink-0">
            SK Malls
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-700">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-brand">
                {link.label}
              </Link>
            ))}
          </nav>

          <form action="/shop" className="ml-auto flex-1 max-w-md">
            <label htmlFor="q" className="sr-only">Search products</label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Search products, brands, stores"
              className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-brand"
            />
          </form>

          <div className="flex items-center gap-4 text-sm font-medium text-gray-700 shrink-0">
            <Link href="/wishlist" aria-label="Wishlist">Wishlist</Link>
            <Link href="/cart" aria-label="Cart">Cart</Link>
            <Link href="/account" aria-label="Account">Account</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 bg-gray-50 py-10 text-sm text-gray-600">
        <div className="mx-auto max-w-7xl px-4 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="font-display font-semibold text-gray-900 mb-2">SK Malls</p>
            <p>A multi-vendor mall — shop from many sellers, one cart, one checkout.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">Shop</p>
            <ul className="space-y-1">
              <li><Link href="/shop">All products</Link></li>
              <li><Link href="/stores">All stores</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">Sell on SK Malls</p>
            <ul className="space-y-1">
              <li><Link href="/seller/register">Become a seller</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">Support</p>
            <ul className="space-y-1">
              <li><Link href="/legal/privacy">Privacy Policy</Link></li>
              <li><Link href="/legal/terms">Terms & Conditions</Link></li>
              <li><Link href="/legal/returns">Return & Refund Policy</Link></li>
              <li><Link href="/legal/faq">FAQ</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
