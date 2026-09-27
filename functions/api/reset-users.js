export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Delete old users table
    await env.DB.prepare(`DROP TABLE IF EXISTS users`).run();

    // Create a clean users table
    await env.DB.prepare(`
      CREATE TABLE users (
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
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    return Response.json({
      ok: true,
      message: 'Users table reset successfully'
    });

  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
                         }
