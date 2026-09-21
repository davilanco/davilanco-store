export async function onRequest(context) {
  await context.env.DB.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, firstname TEXT, lastname TEXT, nickname TEXT UNIQUE, phone TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'customer', address TEXT, products TEXT, idnumber TEXT, idphoto TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, price INTEGER, category TEXT, image TEXT, description TEXT, seller_id TEXT, status TEXT DEFAULT 'pending', source_url TEXT);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT, items TEXT, total INTEGER, delivery TEXT, status TEXT DEFAULT 'Pending', tracking TEXT, logistics TEXT, eta TEXT, payment_method TEXT, payment_status TEXT);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, from_id TEXT, to_id TEXT, to_role TEXT, text TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  return context.next();
                            }
