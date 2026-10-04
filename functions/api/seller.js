export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const nickname = url.searchParams.get('nickname') || '';

  try {
    // optional columns
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN photo TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN bio TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN store_name TEXT').run(); } catch (e) {}

    let user = null;
    if (id) {
      user = await env.DB.prepare(`
        SELECT id, firstname, lastname, nickname, phone, email, role, photo, bio, store_name, created_at
        FROM users WHERE id = ? AND (role = 'seller' OR role = 'admin')
      `).bind(id).first();
    } else if (nickname) {
      user = await env.DB.prepare(`
        SELECT id, firstname, lastname, nickname, phone, email, role, photo, bio, store_name, created_at
        FROM users WHERE nickname = ? AND (role = 'seller' OR role = 'admin')
      `).bind(nickname).first();
    }

    if (!user) {
      return Response.json({ error: 'Seller not found' }, { status: 404 });
    }

    // products by this seller
    const { results } = await env.DB.prepare(`
      SELECT id, name, price, old_price, image, stock, category, status
      FROM products
      WHERE seller_id = ? AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(user.id).all();

    return Response.json({
      ok: true,
      seller: user,
      products: results || []
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
    }
