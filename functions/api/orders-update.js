export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const orderId = (body.order_id || '').trim();

    if (!orderId) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Build update fields safely
    const status = body.status || null;
    const paymentStatus = body.payment_status || null;
    const trackingNumber = body.tracking_number || null;
    const logistics = body.logistics || null;
    const eta = body.eta || null;

    // Check order exists
    const existing = await env.DB.prepare(
      'SELECT id FROM orders WHERE id = ?'
    ).bind(orderId).first();

    if (!existing) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    await env.DB.prepare(`
      UPDATE orders SET
        status = COALESCE(?, status),
        payment_status = COALESCE(?, payment_status),
        tracking_number = COALESCE(?, tracking_number),
        logistics = COALESCE(?, logistics),
        eta = COALESCE(?, eta)
      WHERE id = ?
    `).bind(
      status,
      paymentStatus,
      trackingNumber,
      logistics,
      eta,
      orderId
    ).run();

    return Response.json({
      ok: true,
      message: 'Order updated successfully',
      order_id: orderId
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
