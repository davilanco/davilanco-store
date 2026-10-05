export async function onRequestGet(context) {
  const { env } = context;

  try {
    await env.DB.prepare(`DROP TABLE IF EXISTS order_items`).run();
    await env.DB.prepare(`DROP TABLE IF EXISTS orders`).run();

    await env.DB.prepare(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        total REAL NOT NULL,
        status TEXT DEFAULT 'Pending',
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        payment_reference TEXT,
        firstname TEXT,
        lastname TEXT,
        phone TEXT,
        alt_phone TEXT,
        neighbor_phone TEXT,
        address TEXT,
        town TEXT,
        lga TEXT,
        state TEXT,
        tracking_number TEXT,
        logistics TEXT,
        eta TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        image TEXT
      )
    `).run();

    return Response.json({
      ok: true,
      message: 'Orders tables reset successfully'
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
}
