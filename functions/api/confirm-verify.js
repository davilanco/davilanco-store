export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();

    if (!email || !code) {
      return Response.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, verify_code, verify_expires, verified FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }

    if (user.verified === 1) {
      return Response.json({ ok: true, message: 'Already verified. You can log in.' });
    }

    if (!user.verify_code || user.verify_code !== code) {
      return Response.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    if (user.verify_expires && new Date(user.verify_expires) < new Date()) {
      return Response.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
    }

    await env.DB.prepare(`
      UPDATE users
      SET verified = 1, verify_code = NULL, verify_expires = NULL
      WHERE id = ?
    `).bind(user.id).run();

    return Response.json({
      ok: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
