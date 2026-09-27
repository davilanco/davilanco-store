export async function onRequestGet(context) {
  const { env } = context;

  try {
    // USERS
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

    // PRODUCTS
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

    // ORDERS
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
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

    // ORDER ITEMS
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        image TEXT
      )
    `).run();

    // MESSAGES
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT,
        receiver_id TEXT,
        receiver_role TEXT,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // NOTIFICATIONS
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // SELLER APPLICATIONS
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS seller_applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        products TEXT NOT NULL,
        address TEXT NOT NULL,
        id_number TEXT NOT NULL,
        id_photo TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    return Response.json({
      ok: true,
      message: "All tables created successfully"
    });

  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
                         }
