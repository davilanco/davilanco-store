export async function onRequestPost(context) {
  const { request, env } = context;

  try {
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
        verify_code TEXT,
        verify_expires TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // Add columns if table already existed without them
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN verify_code TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN verify_expires TEXT').run(); } catch (e) {}

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
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await env.DB.prepare(`
      INSERT INTO users (
        id, firstname, lastname, nickname, phone, email, password,
        role, status, verified, verify_code, verify_expires
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'customer', 'active', 0, ?, ?)
    `).bind(
      id, firstname, lastname, nickname, phone, email, hashedPassword, code, expires
    ).run();

    // Send verification email via Resend
    let emailSent = false;
    let emailError = null;

    if (env.RESEND_API_KEY) {
      try {
        const from = env.FROM_EMAIL || 'Davilanco <onboarding@resend.dev>';
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: from,
            to: [email],
            subject: 'Verify your Davilanco account',
            html:
              '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">' +
              '<h2 style="color:#000">Welcome to Davilanco</h2>' +
              '<p>Hi ' + firstname + ',</p>' +
              '<p>Your verification code is:</p>' +
              '<p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#B8860B">' + code + '</p>' +
              '<p>This code expires in 30 minutes.</p>' +
              '<p>Or open: <a href="https://shop.davilanco.com/verify.html?email=' + encodeURIComponent(email) + '">Verify page</a></p>' +
              '<p style="color:#666;font-size:13px">If you did not create this account, ignore this email.</p>' +
              '</div>'
          })
        });

        if (res.ok) {
          emailSent = true;
        } else {
          const errBody = await res.text();
          emailError = errBody;
        }
      } catch (e) {
        emailError = e.message;
      }
    } else {
      emailError = 'RESEND_API_KEY not set';
    }

    return Response.json({
      ok: true,
      message: emailSent
        ? 'Account created. Check your email for the verification code.'
        : 'Account created, but email could not be sent. Use Resend later or contact support.',
      email: email,
      email_sent: emailSent,
      email_error: emailError
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
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
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
