export async function onRequestGet(context) {
  const { env } = context;

  try {
    await env.DB.prepare(`DROP TABLE IF EXISTS messages`).run();

    await env.DB.prepare(`
      CREATE TABLE messages (
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

    return Response.json({
      ok: true,
      message: "Messages table reset successfully"
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
      }
