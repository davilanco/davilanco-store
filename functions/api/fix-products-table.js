export async function onRequestGet(context) {
  const { env } = context;

  try {
    const columns = [
      'ALTER TABLE products ADD COLUMN description TEXT',
      'ALTER TABLE products ADD COLUMN slug TEXT',
      'ALTER TABLE products ADD COLUMN old_price REAL',
      'ALTER TABLE products ADD COLUMN category TEXT',
      'ALTER TABLE products ADD COLUMN image TEXT',
      'ALTER TABLE products ADD COLUMN images TEXT',
      'ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0',
      'ALTER TABLE products ADD COLUMN status TEXT DEFAULT \'pending\'',
      'ALTER TABLE products ADD COLUMN seller_id TEXT',
      'ALTER TABLE products ADD COLUMN source TEXT',
      'ALTER TABLE products ADD COLUMN source_url TEXT',
      'ALTER TABLE products ADD COLUMN created_at TEXT',
      'ALTER TABLE products ADD COLUMN updated_at TEXT'
    ];

    const results = [];

    for (const sql of columns) {
      try {
        await env.DB.prepare(sql).run();
        results.push({ sql, status: 'added' });
      } catch (err) {
        results.push({ sql, status: 'skipped', reason: err.message });
      }
    }

    return Response.json({
      ok: true,
      message: 'Products table columns checked/updated',
      details: results
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
}
