export async function onRequestGet(context) {
  const { env } = context;

  try {
    await env.DB.prepare(`DROP TABLE IF EXISTS products`).run();

    await env.DB.prepare(`
      CREATE TABLE products (
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

    const products = [
      ['Classic White Sneakers', 'Comfortable and stylish white sneakers for everyday wear.', 18500, 22000, 'fashion', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500', 25],
      ['Wireless Bluetooth Earbuds', 'High quality wireless earbuds with noise cancellation.', 12500, 15000, 'electronics', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500', 40],
      ['Minimalist Wrist Watch', 'Elegant minimalist watch with leather strap.', 9800, 0, 'fashion', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', 15],
      ['Organic Face Cream', 'Natural organic face cream for glowing skin.', 6500, 8000, 'beauty', 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500', 30],
      ['Smart LED Desk Lamp', 'Adjustable LED desk lamp with USB charging port.', 14500, 17000, 'home', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500', 20],
      ['Leather Crossbody Bag', 'Premium quality leather crossbody bag.', 22000, 28000, 'fashion', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500', 12]
    ];

    let count = 0;

    for (const p of products) {
      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO products (id, name, description, price, old_price, category, image, stock, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')
      `).bind(id, p[0], p[1], p[2], p[3], p[4], p[5], p[6]).run();

      count++;
    }

    return Response.json({
      ok: true,
      message: count + ' sample products added successfully'
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
}
