export async function onRequest(context) {
  const { request, env } = context;

  // Allow AliExpress to verify the endpoint
  if (request.method === 'GET') {
    return Response.json({
      ok: true,
      message: 'Davilanco AliExpress webhook is live',
      url: 'https://shop.davilanco.com/api/ae-webhook'
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let payload = null;

    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      const text = await request.text();
      try {
        payload = JSON.parse(text);
      } catch (e) {
        payload = { raw: text };
      }
    }

    // Store last webhook events (optional table)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ae_webhooks (
        id TEXT PRIMARY KEY,
        payload TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO ae_webhooks (id, payload) VALUES (?, ?)'
    ).bind(id, JSON.stringify(payload)).run();

    // AliExpress typically expects HTTP 200
    return Response.json({ ok: true, id: id });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
