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
        referral_code TEXT,
        referred_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // Safe migrations for databases created before referral tracking.
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN verify_code TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN verify_expires TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN referral_code TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN referred_by TEXT').run(); } catch (e) {}
    await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique ON users(UPPER(referral_code))').run();

    const body = await request.json();
    const firstname = String(body.firstname || '').trim();
    const lastname = String(body.lastname || '').trim();
    const nickname = String(body.nickname || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const suppliedReferralCode = String(body.referral_code || '').trim().toUpperCase();

    if (!firstname || !lastname || !nickname || !phone || !email || !password) {
      return Response.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return Response.json({
        error: 'Password must be at least 8 characters and contain uppercase, number and symbol'
      }, { status: 400 });
    }

    let referrer = null;
    if (suppliedReferralCode) {
      referrer = await env.DB.prepare(
        'SELECT id FROM users WHERE UPPER(referral_code) = ? LIMIT 1'
      ).bind(suppliedReferralCode).first();
      if (!referrer) {
        return Response.json({ error: 'That referral code was not found. Check it or leave the field blank.' }, { status: 400 });
      }
    }

    const id = crypto.randomUUID();
    const referralCode = await makeUniqueReferralCode(env, nickname);
    const hashedPassword = await hashPassword(password);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await env.DB.prepare(`
      INSERT INTO users (
        id, firstname, lastname, nickname, phone, email, password,
        role, status, verified, verify_code, verify_expires, referral_code, referred_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'customer', 'active', 0, ?, ?, ?, ?)
    `).bind(
      id, firstname, lastname, nickname, phone, email, hashedPassword, code, expires, referralCode, referrer ? referrer.id : null
    ).run();

    // Email verification remains the only notification channel for now.
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
            from,
            to: [email],
            subject: 'Verify your Davilanco account',
            html:
              '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">' +
              '<h2 style="color:#000">Welcome to Davilanco</h2>' +
              '<p>Hi ' + escapeHtml(firstname) + ',</p>' +
              '<p>Your verification code is:</p>' +
              '<p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#B8860B">' + code + '</p>' +
              '<p>This code expires in 30 minutes.</p>' +
              '<p>Or open: <a href="https://shop.davilanco.com/verify.html?email=' + encodeURIComponent(email) + '">Verify page</a></p>' +
              '<p style="color:#666;font-size:13px">If you did not create this account, ignore this email.</p>' +
              '</div>'
          })
        });

        if (res.ok) emailSent = true;
        else emailError = await res.text();
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
      email,
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

async function makeUniqueReferralCode(env, nickname) {
  let base = String(nickname || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'DAVILAN';
  if (base.length < 4) base = ('DAV' + base).slice(0, 8);
  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = attempt === 0 ? '' : String(crypto.getRandomValues(new Uint32Array(1))[0] % 90 + 10);
    const candidate = (base.slice(0, 10 - suffix.length) + suffix).slice(0, 10);
    const existing = await env.DB.prepare('SELECT id FROM users WHERE UPPER(referral_code) = ? LIMIT 1').bind(candidate).first();
    if (!existing) return candidate;
  }
  throw new Error('Could not generate a unique referral code. Please try again.');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256
  );
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  return saltHex + ':' + hashHex;
}
