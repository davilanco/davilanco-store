import { requireAdmin } from '../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const orderId = String(body.order_id || '').trim();
    if (!orderId) return Response.json({ error: 'order_id required' }, { status: 400 });

    for (const sql of [
      'ALTER TABLE orders ADD COLUMN ae_order_id TEXT',
      'ALTER TABLE orders ADD COLUMN tracking_carrier TEXT',
      'ALTER TABLE orders ADD COLUMN ae_status TEXT'
    ]) { try { await env.DB.prepare(sql).run(); } catch (_) {} }

    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!order.ae_order_id) return Response.json({ error: 'Place the supplier order first; no AliExpress order reference is saved.' }, { status: 409 });
    if (!env.AE_APP_KEY || !env.AE_APP_SECRET || !env.AE_ACCESS_TOKEN) {
      return Response.json({ error: 'AliExpress API credentials are not configured in Cloudflare.' }, { status: 503 });
    }

    const result = await callIop(env, 'aliexpress.ds.trade.order.get', {
      order_id: String(order.ae_order_id),
      access_token: env.AE_ACCESS_TOKEN,
      session: env.AE_ACCESS_TOKEN
    });
    if (result.error) return Response.json({ error: 'AliExpress could not return tracking details right now.' }, { status: 502 });

    const root = result.raw.aliexpress_ds_trade_order_get_response ||
      result.raw.aliexpress_trade_ds_order_get_response || result.raw;
    const data = root.result || root;
    const logisticsBlock = data.logistics_info_list || {};
    let logistics = logisticsBlock.ae_order_logistics_info || logisticsBlock;
    if (!Array.isArray(logistics)) logistics = logistics ? [logistics] : [];
    const first = logistics.find(x => x && (x.logistics_no || x.logistics_service)) || {};
    const trackingNumber = String(first.logistics_no || '').trim();
    const carrier = String(first.logistics_service || '').trim();
    const logisticsStatus = String(data.logistics_status || data.order_status || '').trim();

    await env.DB.prepare(`
      UPDATE orders SET
        tracking_number = CASE WHEN ? <> '' THEN ? ELSE tracking_number END,
        tracking_carrier = CASE WHEN ? <> '' THEN ? ELSE tracking_carrier END,
        logistics = CASE WHEN ? <> '' THEN ? ELSE logistics END,
        ae_status = CASE WHEN ? <> '' THEN ? ELSE ae_status END,
        status = CASE
          WHEN UPPER(?) LIKE '%DELIVER%' THEN 'Delivered'
          WHEN UPPER(?) LIKE '%SEND_GOODS%' OR UPPER(?) LIKE '%SHIPPING%' OR UPPER(?) LIKE '%TRANSIT%' THEN 'Shipping'
          ELSE status
        END
      WHERE id = ?
    `).bind(
      trackingNumber, trackingNumber,
      carrier, carrier,
      carrier, carrier,
      logisticsStatus, logisticsStatus,
      logisticsStatus, logisticsStatus, logisticsStatus,
      orderId
    ).run();

    return Response.json({
      ok: true,
      ae_order_id: String(order.ae_order_id),
      tracking: trackingNumber ? { number: trackingNumber, carrier: carrier || null } : null,
      supplier_status: logisticsStatus || null,
      message: trackingNumber ? 'Tracking details refreshed.' : 'No tracking number is available yet. Try again after the supplier ships the order.'
    });
  } catch (_) {
    return Response.json({ error: 'Could not refresh tracking details.' }, { status: 500 });
  }
}

async function callIop(env, methodName, businessParams) {
  const params = {
    method: methodName,
    app_key: String(env.AE_APP_KEY),
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    format: 'json',
    v: '2.0'
  };
  for (const [key, value] of Object.entries(businessParams)) {
    if (value !== undefined && value !== null && String(value) !== '') params[key] = String(value);
  }
  params.sign = await iopSign(methodName, params, env.AE_APP_SECRET);
  const formBody = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]))).join('&');
  let lastError = 'AliExpress API request failed';
  for (const gateway of ['https://api-sg.aliexpress.com/sync', 'https://api-sg.aliexpress.com/rest']) {
    try {
      const response = await fetch(gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: formBody
      });
      const raw = await response.json();
      if (raw && raw.error_response) {
        lastError = raw.error_response.sub_msg || raw.error_response.msg || raw.error_response.code || lastError;
        continue;
      }
      return { raw, error: null };
    } catch (_) {
      lastError = 'AliExpress API connection failed';
    }
  }
  return { error: lastError };
}

async function iopSign(apiPath, params, secret) {
  const keys = Object.keys(params).sort();
  let value = apiPath;
  for (const key of keys) {
    if (key !== 'sign' && params[key] !== undefined && params[key] !== null && String(params[key]) !== '') value += key + String(params[key]);
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
