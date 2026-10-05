export async function onRequest(context) {
  const { request, env } = context;

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT,
      sender_role TEXT,
      sender_name TEXT,
      receiver_id TEXT,
      receiver_role TEXT,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('user_id') || '';
      const all = url.searchParams.get('all') || '';

      let results = [];

      if (all === '1') {
        const data = await env.DB.prepare(`
          SELECT * FROM messages
          ORDER BY created_at DESC
          LIMIT 150
        `).all();
        results = data.results || [];
      } else if (userId) {
        const data = await env.DB.prepare(`
          SELECT * FROM messages
          WHERE sender_id = ? OR receiver_id = ?
          ORDER BY created_at ASC
          LIMIT 100
        `).bind(userId, userId).all();
        results = data.results || [];
      }

      return Response.json({ ok: true, messages: results });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const text = String(body.message || '').trim();

      if (!text) {
        return Response.json({ error: 'Message is required' }, { status: 400 });
      }

      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO messages (
          id, sender_id, sender_role, sender_name,
          receiver_id, receiver_role, message, is_read
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(
        id,
        body.sender_id || null,
        body.sender_role || 'customer',
        body.sender_name || '',
        body.receiver_id || null,
        body.receiver_role || 'admin',
        text
      ).run();

      return Response.json({ ok: true, message: 'Sent', id });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  if (request.method === 'PATCH') {
    try {
      const body = await request.json();
      if (body.action === 'mark_read' && body.user_id) {
        await env.DB.prepare(`
          UPDATE messages SET is_read = 1
          WHERE receiver_id = ? OR (receiver_role = 'admin' AND ? = 'admin')
        `).bind(body.user_id, body.user_id).run();
      }
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
