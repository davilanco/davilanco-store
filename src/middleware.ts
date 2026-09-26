import { defineMiddleware } from 'astro:middleware';
import { getUser } from './lib/auth';

export const onRequest = defineMiddleware(async ({ locals, request, redirect }, next) => {
  const runtime = locals.runtime;
  locals.user = await getUser(runtime.env.DB, runtime.env, request.headers.get('cookie'));

  const pathname = new URL(request.url).pathname;
  const protectedRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/checkout') || pathname.startsWith('/admin') || pathname.startsWith('/seller') || pathname.startsWith('/messages');
  if (protectedRoute && !locals.user) {
    const target = `${pathname}${new URL(request.url).search}`;
    return redirect(`/login?next=${encodeURIComponent(target)}`);
  }
  if (pathname.startsWith('/admin') && locals.user?.role !== 'admin') return redirect('/dashboard');
  if (pathname.startsWith('/seller') && !['seller','admin'].includes(locals.user?.role || '')) return redirect('/dashboard');
  return next();
});
