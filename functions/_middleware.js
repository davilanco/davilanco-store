import { requireSession } from './lib/auth.js';
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const isAdminRoute = path === '/admin' || path.startsWith('/admin/');
  const isSellerRoute = path === '/seller' || path.startsWith('/seller/');
  if (!isAdminRoute && !isSellerRoute) return next();
  const auth = await requireSession(request, env);
  if (!auth.ok) {
    const destination = isAdminRoute ? '/admin/' : '/seller/';
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
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
