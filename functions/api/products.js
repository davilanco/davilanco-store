export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Ensure table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        old_price REAL DEFAULT 0,
        category TEXT,
        image TEXT,
        stock INTEGER DEFAULT 0,
        status TEXT DEFAULT 'approved',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // Get all products
    const { results } = await env.DB.prepare(`
      SELECT * FROM products
      ORDER BY created_at DESC
      LIMIT 100
    `).all();

    return new Response(JSON.stringify(results || []), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
