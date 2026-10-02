export async function onRequest(context) {
  const { request, env } = context;

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
      seller_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN description TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN old_price REAL DEFAULT 0').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN category TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN image TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN status TEXT DEFAULT \'approved\'').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN seller_id TEXT').run(); } catch (e) {}

  // ========== GET ==========
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const all = url.searchParams.get('all') || '';
      const status = url.searchParams.get('status') || '';
      const id = url.searchParams.get('id') || '';

      if (id) {
        const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
        return Response.json(row || { error: 'Not found' }, { status: row ? 200 : 404 });
      }

      let query = 'SELECT * FROM products';
      const params = [];

      if (all === '1') {
        // admin: everything
        if (status) {
          query += ' WHERE status = ?';
          params.push(status);
        }
      } else {
        // public storefront: approved only
        query += " WHERE status = 'approved'";
      }

      query += ' ORDER BY created_at DESC LIMIT 200';

      const stmt = env.DB.prepare(query);
      const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();

      return new Response(JSON.stringify(results || []), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ========== POST create product ==========
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const action = body.action || 'create';

      // Update existing
      if (action === 'update') {
        const productId = (body.id || '').trim();
        if (!productId) {
          return Response.json({ error: 'id required' }, { status: 400 });
        }

        await env.DB.prepare(`
          UPDATE products SET
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            price = COALESCE(?, price),
            old_price = COALESCE(?, old_price),
            category = COALESCE(?, category),
            image = COALESCE(?, image),
            stock = COALESCE(?, stock),
            status = COALESCE(?, status)
          WHERE id = ?
        `).bind(
          body.name || null,
          body.description || null,
          body.price != null ? Number(body.price) : null,
          body.old_price != null ? Number(body.old_price) : null,
          body.category || null,
          body.image || null,
          body.stock != null ? Number(body.stock) : null,
          body.status || null,
          productId
        ).run();

        return Response.json({ ok: true, message: 'Product updated', id: productId });
      }

      // Approve / reject
      if (action === 'set_status') {
        const productId = (body.id || '').trim();
        const status = body.status || 'pending';
        if (!productId) {
          return Response.json({ error: 'id required' }, { status: 400 });
        }
        await env.DB.prepare(
          'UPDATE products SET status = ? WHERE id = ?'
        ).bind(status, productId).run();
        return Response.json({ ok: true, message: 'Status updated', id: productId, status: status });
      }

      // Delete
      if (action === 'delete') {
        const productId = (body.id || '').trim();
        if (!productId) {
          return Response.json({ error: 'id required' }, { status: 400 });
        }
        await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run();
        return Response.json({ ok: true, message: 'Product deleted' });
      }

      // Create
      const name = String(body.name || '').trim();
      const price = Number(body.price);
      if (!name || !price || price <= 0) {
        return Response.json({ error: 'Name and valid price required' }, { status: 400 });
      }

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO products (
          id, name, description, price, old_price, category, image, stock, status, seller_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        name,
        String(body.description || ''),
        price,
        Number(body.old_price) || 0,
        String(body.category || 'others'),
        String(body.image || ''),
        Number(body.stock) || 0,
        body.status || 'approved',
        body.seller_id || null
      ).run();

      return Response.json({ ok: true, message: 'Product added', id: id });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
    }
