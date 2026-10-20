export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const secret = env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return Response.json({ error: 'Paystack secret key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const orderId = String(body.order_id || '').trim();
    if (!orderId) return Response.json({ error: 'Order ID is required.' }, { status: 400 });

    const order = await env.DB.prepare('SELECT id, user_id, total, payment_status FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
    if (String(order.payment_status || '').toLowerCase() === 'paid') {
      return Response.json({ error: 'This order is already marked as paid.' }, { status: 409 });
    }

    let email = String(body.email || '').trim().slice(0, 200);
    if (order.user_id) {
      const customer = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(order.user_id).first();
      if (customer && customer.email) email = String(customer.email);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'A valid email address is required for Paystack.' }, { status: 400 });
    }

    const amount = Math.round(Number(order.total) * 100); // Paystack uses kobo; amount comes from DB.
    const reference = String(order.id);
    const callback_url = 'https://shop.davilanco.com/payment-success.html';
    if (!Number.isSafeInteger(amount) || amount < 100) {
      return Response.json({ error: 'Order total is invalid.' }, { status: 400 });
    }

    await env.DB.prepare('UPDATE orders SET payment_reference = ? WHERE id = ?').bind(reference, order.id).run();

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        amount: amount,
        reference: reference,
        callback_url: callback_url,
        currency: 'NGN',
        metadata: {
          order_id: order.id,
          custom_fields: [
            {
              display_name: 'Order ID',
              variable_name: 'order_id',
              value: order.id
            }
          ]
        }
      })
    });

    const data = await res.json();

    if (!data.status) {
      return Response.json({ error: data.message || 'Paystack init failed' }, { status: 400 });
    }

    return Response.json({
      ok: true,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
        }
