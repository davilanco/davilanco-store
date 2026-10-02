export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, firstname, verified FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }

    if (user.verified === 1) {
      return Response.json({ ok: true, message: 'Already verified' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await env.DB.prepare(`
      UPDATE users SET verify_code = ?, verify_expires = ? WHERE id = ?
    `).bind(code, expires, user.id).run();

    if (!env.RESEND_API_KEY) {
      return Response.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const from = env.FROM_EMAIL || 'Davilanco <no-reply@shop.davilanco.com>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: from,
        to: [email],
        subject: 'Your Davilanco verification code',
        html:
          '<p>Hi ' + (user.firstname || '') + ',</p>' +
          '<p>Your new code is: <strong style="font-size:24px">' + code + '</strong></p>' +
          '<p>Expires in 30 minutes.</p>'
      })
    });

    if (!res.ok) {
      const t = await res.text();
      return Response.json({ error: 'Failed to send email: ' + t }, { status: 500 });
    }

    return Response.json({ ok: true, message: 'Verification code sent' });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
         }
