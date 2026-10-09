export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const orderId = body.order_id;
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!order || !order.ae_order_id) {
      return Response.json({ error: 'order missing ae_order_id' }, { status: 400 });
    }

    // Prefer:
    // aliexpress.ds.trade.order.get  { order_id: ae_order_id }
    // or aliexpress.ds.order.tracking.get if your app has it

    // Parse logistics_no from response → UPDATE orders SET tracking_number, tracking_carrier, status

    return Response.json({ ok: false, error: 'Add callIop + parse logistics_info_list' });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
         }
