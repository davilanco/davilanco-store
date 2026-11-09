import { requireSession } from './lib/auth.js';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\\/+$/, '') || '/';
  const isAdminRoute = path === '/admin' || path.startsWith('/admin/');
  const isSellerRoute = path === '/seller' || path.startsWith('/seller/');
  const isDashboardRoute = path === '/dashboard.html';

  if (!isAdminRoute && !isSellerRoute && !isDashboardRoute) return next();

  const auth = await requireSession(request, env);
  if (!auth.ok) {
    // A server/database configuration failure is not an unauthenticated visit.
    // Return it clearly instead of redirecting into a confusing login loop.
    if (auth.response && auth.response.status >= 500) return auth.response;
    const destination = isAdminRoute ? '/admin/' : (isSellerRoute ? '/seller/' : '/dashboard.html');
    return Response.redirect(new URL('/login.html?redirect=' + encodeURIComponent(destination), url), 302);
  }

  if (isAdminRoute && auth.user.role !== 'admin') {
    return Response.redirect(new URL('/dashboard.html?access=admin-required', url), 302);
  }
  if (isSellerRoute && auth.user.role !== 'seller' && auth.user.role !== 'admin') {
    return Response.redirect(new URL('/dashboard.html?access=seller-required', url), 302);
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Vary', 'Cookie');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}