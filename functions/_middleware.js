const ALLOWED_ORIGINS = new Set([
  'https://davilanco.com',
  'https://www.davilanco.com'
]);

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
  const headers = new Headers();
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
  }
  if (request.method === 'OPTIONS' && new URL(request.url).pathname.startsWith('/api/')) {
    if (!allowedOrigin) return new Response('Origin not allowed', { status: 403 });
    return new Response(null, { status: 204, headers });
  }
  const response = await context.next();
  if (!allowedOrigin || !new URL(request.url).pathname.startsWith('/api/')) return response;
  const out = new Response(response.body, response);
  for (const [key, value] of headers) out.headers.set(key, value);
  return out;
}
