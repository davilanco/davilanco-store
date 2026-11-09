// Shared server-side session authentication for Cloudflare Pages Functions.
// The signed cookie is HttpOnly; every request re-checks the account and current role in D1.
const encoder = new TextEncoder();

function secretFor(env) {
  return String(env.SESSION_SECRET || env.AE_APP_SECRET || '');
}

function noStoreJson(body, status) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function b64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid token encoding');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function createSessionToken(payload, env) {
  const secret = secretFor(env);
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  const encoded = b64url(encoder.encode(JSON.stringify(payload)));
  return encoded + '.' + b64url(await hmac(secret, encoded));
}

export async function requireSession(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const bearer = authorization.match(/^Bearer\s+([A-Za-z0-9_.-]+)$/i);
  const cookie = request.headers.get('Cookie') || '';
  const cookieMatch = cookie.match(/(?:^|;\s*)davilanco_session=([^;]+)/);
  const token = bearer ? bearer[1] : (cookieMatch ? cookieMatch[1] : '');

  if (!token || token.length > 4096) return unauthorized();
  const secret = secretFor(env);
  if (!secret) return unavailable('Server authentication is not configured. Add SESSION_SECRET in Cloudflare Pages settings.');
  if (!env || !env.DB) return unavailable('The Cloudflare D1 database binding named DB is missing.');

  const parts = token.split('.');
  if (parts.length !== 2) return unauthorized();

  let payload;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, fromB64url(parts[1]), encoder.encode(parts[0]));
    if (!valid) return unauthorized();
    payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
  } catch (_) {
    return unauthorized();
  }

  if (!payload || !payload.id || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return unauthorized();

  let current;
  try {
    current = await env.DB.prepare('SELECT id, role, status, verified FROM users WHERE id = ?').bind(String(payload.id)).first();
  } catch (error) {
    console.error('[auth] D1 session lookup failed:', error);
    return unavailable('Could not verify your account right now. Check the Cloudflare D1 binding and users table.');
  }

  if (!current || current.status === 'suspended' || Number(current.verified) !== 1) return unauthorized();
  return { ok: true, user: { id: String(current.id), role: String(current.role || 'customer'), nickname: payload.nickname || '' } };
}

export async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) return session;
  if (session.user.role !== 'admin') {
    return { ok: false, response: noStoreJson({ error: 'Administrator access required.' }, 403) };
  }
  return session;
}

function unauthorized() {
  return { ok: false, response: noStoreJson({ error: 'Authentication required. Please sign in again.' }, 401) };
}

function unavailable(message) {
  return { ok: false, response: noStoreJson({ error: message }, 503) };
}