export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const secret = env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return Response.json({ error: 'Paystack secret key not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const reference = url.searchParams.get('reference');

    if (!reference) {
      return Response.json({ error: 'Reference is required' }, { status: 400 });
    }

    const res = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
      headers: {
        'Authorization': 'Bearer ' + secret
      }
    });

    const data = await res.json();

    if (!data.status) {
      return Response.json({ error: data.message || 'Verification failed' }, { status: 400 });
    }

    const order = await env.DB.prepare(
      'SELECT id, total, payment_status FROM orders WHERE id = ? OR payment_reference = ? LIMIT 1'
    ).bind(reference, reference).first();
    if (!order) return Response.json({ error: 'No Davilanco order matches this payment reference.' }, { status: 404 });

    const amountMatches = Number(data.data.amount) === Math.round(Number(order.total) * 100);
    const currencyMatches = String(data.data.currency || '').toUpperCase() === 'NGN';
    const paid = data.data.status === 'success' && amountMatches && currencyMatches;

    // Only mark paid when Paystack confirms success and the paid NGN amount matches our database order.
    if (paid) {
      await env.DB.prepare(`
        UPDATE orders SET payment_status = 'paid', status = 'Approved'
        WHERE id = ? AND payment_status <> 'paid'
      `).bind(order.id).run();
    }

    return Response.json({
      ok: true,
      paid: paid,
      status: data.data.status,
      amount: Number(data.data.amount) / 100,
      reference: data.data.reference,
      message: !amountMatches ? 'Payment amount does not match the order total.' : (!currencyMatches ? 'Payment currency does not match NGN.' : undefined)
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
        }
