import { requireSession } from '../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireSession(request, env);
  if (!auth.ok) return auth.response;

  try {
    const user = await env.DB.prepare(`
      SELECT id, firstname, lastname, nickname, phone, email, role
      FROM users WHERE id = ? LIMIT 1
    `).bind(auth.user.id).first();

    if (!user) {
      return Response.json({ error: 'Account not found. Please sign in again.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ ok: true, user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[session] Could not load account:', error);
    return Response.json({ error: 'Could not load your account details right now.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}