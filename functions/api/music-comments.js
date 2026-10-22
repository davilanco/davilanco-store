import { requireSession } from '../lib/auth.js';

const json = (data, status = 200) => Response.json(data, { status });
const MAX_COMMENT_LENGTH = 1000;

async function ensureTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS music_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();
  // Older Store databases may not yet have a profile-photo column.
  try { await env.DB.prepare('ALTER TABLE users ADD COLUMN photo TEXT').run(); } catch (_) {}
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return json({ error: 'Method not allowed' }, 405);
  }
  try {
    await ensureTables(env);
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const mine = url.searchParams.get('mine') === '1';
      if (mine) {
        const auth = await requireSession(request, env);
        if (!auth.ok) return auth.response;
        const profile = await env.DB.prepare(
          'SELECT id, firstname, lastname, nickname, email, photo, created_at FROM users WHERE id = ?'
        ).bind(auth.user.id).first();
        const { results } = await env.DB.prepare(`
          SELECT id, track_id, comment, created_at
          FROM music_comments WHERE user_id = ?
          ORDER BY created_at DESC LIMIT 200
        `).bind(auth.user.id).all();
        return json({ ok: true, user: profile || null, comments: results || [] });
      }
      const track = String(url.searchParams.get('track') || '').trim();
      if (!track || track.length > 120) return json({ error: 'A valid track is required' }, 400);
      const { results } = await env.DB.prepare(`
        SELECT c.id, c.track_id, c.comment, c.created_at, u.nickname, u.firstname, u.lastname
        FROM music_comments c JOIN users u ON u.id = c.user_id
        WHERE c.track_id = ?
        ORDER BY c.created_at DESC LIMIT 100
      `).bind(track).all();
      return json({ ok: true, comments: results || [] });
    }

    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    if (request.method === 'POST') {
      const body = await request.json();
      const track = String(body.track_id || '').trim();
      const comment = String(body.comment || '').trim();
      if (!track || track.length > 120) return json({ error: 'A valid track is required' }, 400);
      if (!comment || comment.length > MAX_COMMENT_LENGTH) {
        return json({ error: 'Comment must be between 1 and 1000 characters' }, 400);
      }
      const result = await env.DB.prepare(
        'INSERT INTO music_comments (user_id, track_id, comment) VALUES (?, ?, ?)'
      ).bind(auth.user.id, track, comment).run();
      return json({ ok: true, id: result.meta?.last_row_id || null }, 201);
    }

    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));
    if (!Number.isInteger(id) || id < 1) return json({ error: 'A valid comment id is required' }, 400);
    const result = await env.DB.prepare(
      'DELETE FROM music_comments WHERE id = ? AND user_id = ?'
    ).bind(id, auth.user.id).run();
    if (!result.meta?.changes) return json({ error: 'Comment not found or you do not own it' }, 404);
    return json({ ok: true });
  } catch (_) {
    return json({ error: 'Unable to process music comments right now' }, 500);
  }
}
