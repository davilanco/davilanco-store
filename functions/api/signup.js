export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Ensure users table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        firstname TEXT NOT NULL,
        lastname TEXT NOT NULL,
        nickname TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'customer',
        status TEXT DEFAULT 'active',
        verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    const body = await request.json();
    const firstname = (body.firstname || '').trim();
    const lastname = (body.lastname || '').trim();
    const nickname = (body.nickname || '').trim();
    const phone = (body.phone || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!firstname || !lastname || !nickname || !phone || !email || !password) {
      return Response.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Strong password check
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
      INSERT INTO users (id, firstname, lastname, nickname, phone, email, password, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'customer')
    `).bind(id, firstname, lastname, nickname, phone, email, hashedPassword).run();

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

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');

  const saltArray = Array.from(salt);
  const saltHex = saltArray.map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');

  return saltHex + ':' + hashHex;
        }
