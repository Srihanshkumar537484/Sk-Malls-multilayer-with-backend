import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs on every request. Two jobs:
 *  1. Refresh the Supabase auth session (required by @supabase/ssr).
 *  2. Gate /admin/* and /seller/dashboard* etc by role, checked against the
 *     `profiles.role` column — never trust a client-supplied role claim.
 * This is a first line of defense for UX (redirecting the wrong role away);
 * RLS in Postgres is the real enforcement and holds even if this middleware
 * were bypassed entirely.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith('/admin');
  const isSellerRoute = path.startsWith('/seller/dashboard') || path.startsWith('/seller/products') || path.startsWith('/seller/orders') || path.startsWith('/seller/earnings');

  if (isAdminRoute || isSellerRoute) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (isAdminRoute && profile?.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (isSellerRoute && profile?.role !== 'seller') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/seller/dashboard/:path*',
    '/seller/products/:path*',
    '/seller/orders/:path*',
    '/seller/earnings/:path*',
  ],
};
