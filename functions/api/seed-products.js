export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Make sure products table exists
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
        image TEXT,
        stock INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // Sample products
    const products = [
      {
        id: crypto.randomUUID(),
        name: "Classic White Sneakers",
        description: "Comfortable and stylish white sneakers perfect for everyday wear. Available in multiple sizes.",
        price: 18500,
        old_price: 22000,
        category: "fashion",
        image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500",
        stock: 25,
        status: "approved"
      },
      {
        id: crypto.randomUUID(),
        name: "Wireless Bluetooth Earbuds",
        description: "High quality wireless earbuds with noise cancellation and long battery life.",
        price: 12500,
        old_price: 15000,
        category: "electronics",
        image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500",
        stock: 40,
        status: "approved"
      },
      {
        id: crypto.randomUUID(),
        name: "Minimalist Wrist Watch",
        description: "Elegant minimalist watch with leather strap. Perfect gift for any occasion.",
        price: 9800,
        old_price: null,
        category: "fashion",
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
        stock: 15,
        status: "approved"
      },
      {
        id: crypto.randomUUID(),
        name: "Organic Face Cream",
        description: "Natural organic face cream for glowing skin. Suitable for all skin types.",
        price: 6500,
        old_price: 8000,
        category: "beauty",
        image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500",
        stock: 30,
        status: "approved"
      },
      {
        id: crypto.randomUUID(),
        name: "Smart LED Desk Lamp",
        description: "Adjustable LED desk lamp with multiple brightness levels and USB charging port.",
        price: 14500,
        old_price: 17000,
        category: "home",
        image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500",
        stock: 20,
        status: "approved"
      },
      {
        id: crypto.randomUUID(),
        name: "Leather Crossbody Bag",
        description: "Premium quality leather crossbody bag. Stylish and spacious.",
        price: 22000,
        old_price: 28000,
        category: "fashion",
        image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500",
        stock: 12,
        status: "approved"
      }
    ];

    let inserted = 0;

    for (const p of products) {
      await env.DB.prepare(`
        INSERT INTO products (id, name, description, price, old_price, category, image, stock, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        p.id,
        p.name,
        p.description,
        p.price,
        p.old_price,
        p.category,
        p.image,
        p.stock,
        p.status
      ).run();

      inserted++;
    }

    return Response.json({
      ok: true,
      message: inserted + " sample products added successfully"
    });

  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
}
