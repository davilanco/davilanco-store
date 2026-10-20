import { requireAdmin, requireSession } from '../lib/auth.js';
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSession(request, env);
  if (!auth.ok) return auth.response;
  if (auth.user.role !== 'admin' && auth.user.role !== 'seller') {
    return Response.json({ error: 'Administrator or seller access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const orderId = (body.order_id || '').trim();

    if (!orderId) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    let status = body.status || null;
    let paymentStatus = body.payment_status || null;
    const trackingNumber = body.tracking_number || null;
    const logistics = body.logistics || null;
    const eta = body.eta || null;

    const existing = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first();
    if (!existing) return Response.json({ error: 'Order not found' }, { status: 404 });

    if (auth.user.role === 'seller') {
      const ownership = await env.DB.prepare(`
        SELECT 1 AS owned FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ? AND p.seller_id = ?
        LIMIT 1
      `).bind(orderId, auth.user.id).first();
      if (!ownership) return Response.json({ error: 'You may only update tracking for orders containing your products.' }, { status: 403 });
      if (body.payment_status != null) return Response.json({ error: 'Sellers cannot change payment status.' }, { status: 403 });
      if (status && !['Shipping', 'Delivered'].includes(status)) {
        return Response.json({ error: 'Sellers may only set Shipping or Delivered status.' }, { status: 400 });
      }
      paymentStatus = null;
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
