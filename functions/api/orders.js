export async function onRequest(context) {
  const { request, env } = context;

  // Ensure tables exist
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

  // ========== GET – list orders for a user ==========
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('user_id') || '';
      const phone = url.searchParams.get('phone') || '';

      let results = [];

      if (userId) {
        const data = await env.DB.prepare(`
          SELECT * FROM orders
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 50
        `).bind(userId).all();
        results = data.results || [];
      } else if (phone) {
        const data = await env.DB.prepare(`
          SELECT * FROM orders
          WHERE phone = ?
          ORDER BY created_at DESC
          LIMIT 50
        `).bind(phone).all();
        results = data.results || [];
      }

      // Attach items for each order
      for (let i = 0; i < results.length; i++) {
        const items = await env.DB.prepare(`
          SELECT * FROM order_items WHERE order_id = ?
        `).bind(results[i].id).all();
        results[i].items = items.results || [];
      }

      return Response.json({ ok: true, orders: results });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ========== POST – create order ==========
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const items = body.items || [];
      const total = Number(body.total) || 0;

      if (!items.length || total <= 0) {
        return Response.json({ error: 'Cart is empty' }, { status: 400 });
      }

      if (!body.firstname || !body.lastname || !body.phone || !body.address || !body.state) {
        return Response.json({ error: 'Delivery details incomplete' }, { status: 400 });
      }

      const orderId = 'DAV-' + Date.now();
      const paymentMethod = body.payment_method || 'bank_transfer';
      const paymentRef = body.payment_reference || orderId;

      await env.DB.prepare(`
        INSERT INTO orders (
          id, user_id, total, status, payment_method, payment_status, payment_reference,
          firstname, lastname, phone, alt_phone, neighbor_phone,
          address, town, lga, state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        body.user_id || null,
        total,
        'Pending',
        paymentMethod,
        'pending',
        paymentRef,
        body.firstname,
        body.lastname,
        body.phone,
        body.alt_phone || '',
        body.neighbor_phone || '',
        body.address,
        body.town || '',
        body.lga || '',
        body.state
      ).run();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await env.DB.prepare(`
          INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, image)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          orderId,
          item.id || '',
          item.name || 'Product',
          Number(item.price) || 0,
          Number(item.quantity) || 1,
          item.image || ''
        ).run();
      }

      return Response.json({
        ok: true,
        order_id: orderId,
        reference: paymentRef,
        total: total,
        payment_method: paymentMethod
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
                       }
