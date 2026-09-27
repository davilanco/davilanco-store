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

    const paid = data.data.status === 'success';

    // Update order if paid
    if (paid) {
      await env.DB.prepare(`
        UPDATE orders
        SET payment_status = 'paid', status = 'Approved'
        WHERE payment_reference = ? OR id = ?
      `).bind(reference, reference).run();
    }

    return Response.json({
      ok: true,
      paid: paid,
      status: data.data.status,
      amount: data.data.amount / 100,
      reference: data.data.reference,
      gateway_response: data.data.gateway_response
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
        }
