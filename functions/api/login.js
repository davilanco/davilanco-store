export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const login = String(body.login || '').trim();
    const password = String(body.password || '');

    if (!login || !password) {
      return Response.json({ error: 'Login and password are required' }, { status: 400 });
    }

    const user = await env.DB.prepare(`
      SELECT * FROM users
      WHERE nickname = ? OR email = ? OR phone = ?
    `).bind(login, login, login).first();

    if (!user) {
      return Response.json({ error: 'Invalid login or password' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return Response.json({ error: 'Your account has been suspended' }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return Response.json({ error: 'Invalid login or password' }, { status: 401 });
    }

    if (Number(user.verified) !== 1) {
      return Response.json({
        error: 'Please verify your email first',
        needs_verification: true,
        email: user.email
      }, { status: 403 });
    }

    const tokenPayload = {
      id: user.id,
      nickname: user.nickname,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    };

    return Response.json({
      ok: true,
      token: btoa(JSON.stringify(tokenPayload)),
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        role: user.role
      }
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(':') === -1) return false;
  const parts = stored.split(':');
  const saltHex = parts[0];
  const hashHex = parts[1];
  if (!saltHex || !hashHex) return false;

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(function(byte) {
    return parseInt(byte, 16);
  }));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const newHash = Array.from(new Uint8Array(derivedBits)).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
  return newHash === hashHex;
      }
