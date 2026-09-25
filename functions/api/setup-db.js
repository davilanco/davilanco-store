export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 1. Users
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
        address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // 2. Categories
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        image TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // 3. Products
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

    // 4. Orders
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'Pending',
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        payment_reference TEXT,
        transaction_id TEXT,
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
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // 5. Order Items
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        seller_id TEXT,
        image TEXT
      )
    `).run();

    // 6. Cart
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS cart (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, product_id)
      )
    `).run();

    // 7. Messages
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT,
        receiver_role TEXT,
        order_id TEXT,
        subject TEXT,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // 8. Notifications
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // 9. Seller Applications
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS seller_applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        products TEXT NOT NULL,
        address TEXT NOT NULL,
        id_number TEXT NOT NULL,
        id_photo TEXT,
        status TEXT DEFAULT 'pending',
        admin_note TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        reviewed_at TEXT
      )
    `).run();

    // 10. Payments
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        reference TEXT,
        status TEXT DEFAULT 'pending',
        gateway_response TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // Indexes
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`).run();

    return Response.json({
      ok: true,
      message: "All tables created successfully (IF NOT EXISTS)"
    });

  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
}
