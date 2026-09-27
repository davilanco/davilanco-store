export async function onRequest(context) {
  const { request, env } = context;

  // Make sure the products table exists
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      seller_id TEXT,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT,
      price REAL NOT NULL,
      old_price REAL,
      category TEXT,
      category_id TEXT,
      image TEXT,
      images TEXT,
      stock INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      source TEXT,
      source_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // GET – list products
  if (request.method === "GET") {
    try {
      // Only show approved products on the public shop
      // (Admin can later see all statuses)
      const { results } = await env.DB.prepare(`
        SELECT * FROM products 
        WHERE status = 'approved' OR status = 'pending'
        ORDER BY created_at DESC
        LIMIT 50
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

  // POST – add a new product (for admin / seller later)
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO products (
          id, name, description, price, old_price, category, 
          image, stock, status, seller_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name || "Untitled",
        body.description || "",
        Number(body.price) || 0,
        body.old_price ? Number(body.old_price) : null,
        body.category || "General",
        body.image || "",
        Number(body.stock) || 0,
        body.status || "pending",
        body.seller_id || null
      ).run();

      return Response.json({ ok: true, id });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
