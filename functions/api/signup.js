export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const firstname = String(body.firstname || '').trim();
    const lastname = String(body.lastname || '').trim();
    const nickname = String(body.nickname || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!firstname || !lastname || !nickname || !phone || !email || !password) {
      return Response.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return Response.json({
        error: 'Password must be at least 8 characters and contain uppercase, number and symbol'
      }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO users (id, firstname, lastname, nickname, phone, email, password, role, status, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      firstname,
      lastname,
      nickname,
      phone,
      email,
      hashedPassword,
      'customer',
      'active',
      0
    ).run();

    return Response.json({
      ok: true,
      message: 'Account created successfully. You can now log in.'
    });

  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return Response.json({ error: 'Nickname, phone or email already exists' }, { status: 400 });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const hashHex = Array.from(new Uint8Array(derivedBits)).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');

  const saltHex = Array.from(salt).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');

  return saltHex + ':' + hashHex;
                           }
