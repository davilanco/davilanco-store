import { requireAdmin, requireSession } from '../lib/auth.js';
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
        const auth = await requireAdmin(request, env);
        if (!auth.ok) return auth.response;
        const data = await env.DB.prepare(`
          SELECT * FROM messages
          ORDER BY created_at DESC
          LIMIT 150
        `).all();
        results = data.results || [];
      } else if (userId) {
        const auth = await requireSession(request, env);
        if (!auth.ok) return auth.response;
        if (auth.user.id !== userId && auth.user.role !== 'admin') {
          return Response.json({ error: 'You may only view your own messages.' }, { status: 403 });
        }
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
      if (!text || text.length > 5000) {
        return Response.json({ error: 'Message must contain 1–5000 characters.' }, { status: 400 });
      }

      let senderId = null;
      let senderRole = 'customer';
      let senderName = String(body.sender_name || '').slice(0, 120);
      let receiverId = null;
      let receiverRole = 'admin';
      if (body.sender_id) {
        const auth = await requireSession(request, env);
        if (!auth.ok) return auth.response;
        if (auth.user.id !== String(body.sender_id) && auth.user.role !== 'admin') {
          return Response.json({ error: 'You may only send messages as your own account.' }, { status: 403 });
        }
        senderId = auth.user.id;
        senderRole = auth.user.role;
        if (auth.user.role === 'admin') {
          receiverId = body.receiver_id || null;
          receiverRole = body.receiver_role || 'customer';
        }
      }
      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO messages (
          id, sender_id, sender_role, sender_name,
          receiver_id, receiver_role, message, is_read
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(
        id,
        senderId,
        senderRole,
        senderName,
        receiverId,
        receiverRole,
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
      const auth = await requireSession(request, env);
      if (!auth.ok) return auth.response;
      if (body.action === 'mark_read' && body.user_id) {
        if (auth.user.id !== String(body.user_id) && auth.user.role !== 'admin') {
          return Response.json({ error: 'You may only mark your own messages as read.' }, { status: 403 });
        }
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
