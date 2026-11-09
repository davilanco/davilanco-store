import { createSessionToken } from '../lib/auth.js';

function json(body, status) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) {
    return json({ error: 'Login is unavailable: the Cloudflare D1 binding named DB is missing.', code: 'D1_BINDING_MISSING' }, 503);
  }
  if (!env.SESSION_SECRET && !env.AE_APP_SECRET) {
    return json({ error: 'Login is unavailable: configure SESSION_SECRET in Cloudflare Pages environment variables.', code: 'SESSION_SECRET_MISSING' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'The login request was not valid JSON. Refresh the page and try again.', code: 'INVALID_JSON' }, 400);
  }

  const login = String(body.login || '').trim();
  const password = String(body.password || '');
  if (!login || !password) return json({ error: 'Nickname, email or phone and password are required.' }, 400);

  try {
    const user = await env.DB.prepare(`
      SELECT id, firstname, lastname, nickname, phone, email, password, role, status, verified
      FROM users
      WHERE LOWER(nickname) = ? OR LOWER(email) = ? OR phone = ?
      LIMIT 1
    `).bind(login.toLowerCase(), login.toLowerCase(), login).first();

    if (!user) return json({ error: 'Invalid login or password.' }, 401);
    if (user.status === 'suspended') return json({ error: 'Your account has been suspended. Contact support.' }, 403);

    const valid = await verifyPassword(password, user.password);
    if (!valid) return json({ error: 'Invalid login or password.' }, 401);

    if (Number(user.verified) !== 1) {
      return json({
        error: 'Please verify your email before signing in.',
        needs_verification: true,
        email: user.email
      }, 403);
    }

    const token = await createSessionToken({
      id: user.id,
      nickname: user.nickname,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    }, env);

    const response = json({
      ok: true,
      token,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        role: user.role || 'customer'
      }
    }, 200);
    response.headers.append('Set-Cookie', 'davilanco_session=' + token + '; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax');
    return response;
  } catch (error) {
    console.error('[login] Authentication request failed:', error);
    return json({
      error: 'The login service encountered a server/database error. Check the Cloudflare Pages Functions logs, the DB binding, the users table and SESSION_SECRET.',
      code: 'LOGIN_SERVICE_ERROR'
    }, 500);
  }
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const colonIndex = stored.indexOf(':');
  if (colonIndex === -1) return false;
  const saltHex = stored.substring(0, colonIndex);
  const hashHex = stored.substring(colonIndex + 1);
  if (!/^(?:[a-f0-9]{2})+$/i.test(saltHex) || !/^[a-f0-9]{64}$/i.test(hashHex)) return false;

  try {
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const newHash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return newHash.toLowerCase() === hashHex.toLowerCase();
  } catch (_) {
    return false;
  }
}