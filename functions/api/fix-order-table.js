export async function onRequestGet(context) {
  const { env } = context;

  try {
    const columns = [
      "ALTER TABLE orders ADD COLUMN user_id TEXT",
      "ALTER TABLE orders ADD COLUMN total REAL",
      "ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'Pending'",
      "ALTER TABLE orders ADD COLUMN payment_method TEXT",
      "ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'",
      "ALTER TABLE orders ADD COLUMN payment_reference TEXT",
      "ALTER TABLE orders ADD COLUMN firstname TEXT",
      "ALTER TABLE orders ADD COLUMN lastname TEXT",
      "ALTER TABLE orders ADD COLUMN phone TEXT",
      "ALTER TABLE orders ADD COLUMN alt_phone TEXT",
      "ALTER TABLE orders ADD COLUMN neighbor_phone TEXT",
      "ALTER TABLE orders ADD COLUMN address TEXT",
      "ALTER TABLE orders ADD COLUMN town TEXT",
      "ALTER TABLE orders ADD COLUMN lga TEXT",
      "ALTER TABLE orders ADD COLUMN state TEXT",
      "ALTER TABLE orders ADD COLUMN tracking_number TEXT",
      "ALTER TABLE orders ADD COLUMN logistics TEXT",
      "ALTER TABLE orders ADD COLUMN eta TEXT",
      "ALTER TABLE orders ADD COLUMN created_at TEXT"
    ];

    const results = [];

    for (let i = 0; i < columns.length; i++) {
      try {
        await env.DB.prepare(columns[i]).run();
        results.push({ sql: columns[i], status: "added" });
      } catch (err) {
        results.push({ sql: columns[i], status: "skipped", reason: err.message });
      }
    }

    // Ensure order_items table exists
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

    return Response.json({
      ok: true,
      message: "Orders table columns checked/updated",
      details: results
    });

  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
      }
