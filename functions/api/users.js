export async function onRequest(context) {
  const { request, env } = context;

  // Ensure table
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

  // ========== GET all users ==========
  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare(`
        SELECT id, firstname, lastname, nickname, phone, email, role, status, verified, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 200
      `).all();

      return Response.json({ ok: true, users: results || [] });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ========== POST update user (role / status) ==========
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const userId = (body.user_id || '').trim();
      if (!userId) {
        return Response.json({ error: 'user_id required' }, { status: 400 });
      }

      const role = body.role || null;
      const status = body.status || null;

      await env.DB.prepare(`
        UPDATE users SET
          role = COALESCE(?, role),
          status = COALESCE(?, status)
        WHERE id = ?
      `).bind(role, status, userId).run();

      return Response.json({ ok: true, message: 'User updated' });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ========== DELETE user ==========
  if (request.method === 'DELETE') {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('id') || '';
      if (!userId) {
        return Response.json({ error: 'id required' }, { status: 400 });
      }

      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return Response.json({ ok: true, message: 'User deleted' });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
    }
