export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const secret = env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return Response.json({ error: 'Paystack secret key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const email = body.email || 'customer@davilanco.com';
    const amount = Math.round(Number(body.amount) * 100); // Paystack uses kobo
    const reference = body.reference || ('DAV-' + Date.now());
    const callback_url = body.callback_url || 'https://shop.davilanco.com/payment-success.html';

    if (!amount || amount < 100) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

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
          order_id: body.order_id || reference,
          custom_fields: [
            {
              display_name: 'Order ID',
              variable_name: 'order_id',
              value: body.order_id || reference
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
