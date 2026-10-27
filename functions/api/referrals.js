import { requireSession } from '../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSession(request, env);
  if (!auth.ok) return auth.response;

  try {
    // Older D1 databases are upgraded safely on first use.
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN referral_code TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN referred_by TEXT').run(); } catch (e) {}

    const user = await env.DB.prepare('SELECT id, nickname, referral_code FROM users WHERE id = ?').bind(auth.user.id).first();
    if (!user) return Response.json({ error: 'Account not found.' }, { status: 404 });

    let referralCode = user.referral_code;
    if (!referralCode) {
      const base = String(user.nickname || 'DAVILAN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'DAVILAN';
      for (let attempt = 0; attempt < 20; attempt++) {
        const suffix = attempt === 0 ? '' : String(crypto.getRandomValues(new Uint32Array(1))[0] % 90 + 10);
        const candidate = (base.slice(0, 10 - suffix.length) + suffix).slice(0, 10);
        const existing = await env.DB.prepare('SELECT id FROM users WHERE UPPER(referral_code) = ? AND id != ? LIMIT 1').bind(candidate, user.id).first();
        if (!existing) {
          referralCode = candidate;
          await env.DB.prepare('UPDATE users SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR referral_code = "")').bind(referralCode, user.id).run();
          break;
        }
      }
      if (!referralCode) return Response.json({ error: 'Could not create a referral code. Please try again.' }, { status: 500 });
    }

    const data = await env.DB.prepare(`
      SELECT nickname, created_at
      FROM users
      WHERE referred_by = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(user.id).all();
    const referrals = (data.results || []).map(function(item) {
      return { nickname: item.nickname || 'Customer', created_at: item.created_at || '' };
    });
    const baseUrl = new URL(request.url).origin;
    const referralLink = baseUrl + '/signup.html?ref=' + encodeURIComponent(referralCode);

    return Response.json({
      ok: true,
      referral_code: referralCode,
      referral_link: referralLink,
      referral_count: referrals.length,
      referrals
    });
  } catch (e) {
    return Response.json({ error: 'Could not load referral information.' }, { status: 500 });
  }
}
