export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const orderId = body.order_id;
    if (!orderId) return Response.json({ error: 'order_id required' }, { status: 400 });

    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) return Response.json({ error: 'order not found' }, { status: 404 });

    // TODO: load order items + products.ae_product_id / ae_sku_attr
    // Build param_place_order_request4_open_api_d_t_o as JSON string
    // callIop(env, 'aliexpress.trade.buy.placeorder', { ... })

    return Response.json({
      ok: false,
      error: 'Wire product_items + address from your orders table, then call placeorder'
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
