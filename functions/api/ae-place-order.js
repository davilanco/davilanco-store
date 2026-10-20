import { requireAdmin } from '../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const orderId = String(body.order_id || '').trim();
    if (!orderId) return Response.json({ error: 'order_id required' }, { status: 400 });

    await ensureColumns(env);
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (String(order.payment_status || '').toLowerCase() !== 'paid') {
      return Response.json({ error: 'Confirm the customer payment before placing a supplier order.' }, { status: 409 });
    }
    if (order.ae_order_id) {
      return Response.json({ ok: true, already_placed: true, ae_order_id: String(order.ae_order_id) });
    }
    if (order.ae_status === 'submitting' || order.ae_status === 'uncertain') {
      return Response.json({ error: 'A supplier submission is already in progress or needs checking. Check AliExpress order history before trying again.' }, { status: 409 });
    }

    const itemsResult = await env.DB.prepare(`
      SELECT oi.product_id, oi.product_name, oi.quantity, p.ae_product_id, p.ae_sku_attr
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `).bind(orderId).all();
    const items = itemsResult.results || [];
    if (!items.length) return Response.json({ error: 'This order has no items.' }, { status: 400 });

    const supplierItems = [];
    for (const item of items) {
      if (!item.ae_product_id) {
        return Response.json({ error: 'Product "' + safeText(item.product_name) + '" is not linked to an AliExpress product. Import/link it before ordering.' }, { status: 409 });
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return Response.json({ error: 'Invalid product quantity.' }, { status: 400 });
      }
      const supplierItem = { product_id: String(item.ae_product_id), product_count: quantity };
      if (item.ae_sku_attr) supplierItem.sku_attr = String(item.ae_sku_attr);
      supplierItems.push(supplierItem);
    }

    const fullName = [order.firstname, order.lastname].filter(Boolean).join(' ').trim();
    if (!fullName || !order.phone || !order.address || !order.state) {
      return Response.json({ error: 'The delivery name, phone, street address and state are required.' }, { status: 400 });
    }
    if (!env.AE_APP_KEY || !env.AE_APP_SECRET || !env.AE_ACCESS_TOKEN) {
      return Response.json({ error: 'AliExpress API credentials are not configured in Cloudflare.' }, { status: 503 });
    }

    const address = {
      full_name: fullName,
      contact_person: fullName,
      mobile_no: normalizePhone(order.phone),
      phone_country: '+234',
      country: 'NG',
      province: String(order.state),
      city: String(order.town || order.lga || order.state),
      address: String(order.address),
      locale: 'en_NG'
    };
    if (order.lga) address.address2 = String(order.lga);

    // Claim the order before calling the supplier API. This blocks double-clicks and retries.
    await env.DB.prepare("UPDATE orders SET ae_status = 'submitting' WHERE id = ? AND (ae_order_id IS NULL OR ae_order_id = '') AND (ae_status IS NULL OR ae_status IN ('failed','ready'))").bind(orderId).run();
    const claimed = await env.DB.prepare('SELECT ae_status, ae_order_id FROM orders WHERE id = ?').bind(orderId).first();
    if (claimed.ae_order_id) return Response.json({ ok: true, already_placed: true, ae_order_id: String(claimed.ae_order_id) });
    if (claimed.ae_status !== 'submitting') {
      return Response.json({ error: 'This order is being processed by another request. Refresh the order list.' }, { status: 409 });
    }

    const payload = { logistics_address: address, product_items: supplierItems };
    const result = await callIop(env, 'aliexpress.trade.buy.placeorder', {
      param_place_order_request4_open_api_d_t_o: JSON.stringify(payload),
      access_token: env.AE_ACCESS_TOKEN,
      session: env.AE_ACCESS_TOKEN
    });

    if (result.error) {
      await env.DB.prepare("UPDATE orders SET ae_status = 'failed' WHERE id = ? AND ae_status = 'submitting'").bind(orderId).run();
      return Response.json({ error: 'AliExpress did not confirm the order. Check AliExpress order history before retrying.' , supplier_message: String(result.error).slice(0, 180) }, { status: 502 });
    }

    const response = result.raw || {};
    const root = response.aliexpress_trade_buy_placeorder_response || response;
    const supplierResult = root.result || root;
    const success = supplierResult.is_success === true || supplierResult.is_success === 'true';
    const ids = supplierResult.order_list && (supplierResult.order_list.number || supplierResult.order_list);
    const supplierOrderId = Array.isArray(ids) ? String(ids[0] || '') : String(ids || '');

    if (!success || !supplierOrderId) {
      await env.DB.prepare("UPDATE orders SET ae_status = 'failed' WHERE id = ? AND ae_status = 'submitting'").bind(orderId).run();
      return Response.json({ error: 'AliExpress did not confirm a supplier order. Check AliExpress order history before retrying.' }, { status: 502 });
    }

    await env.DB.prepare("UPDATE orders SET ae_order_id = ?, ae_status = 'placed' WHERE id = ?").bind(supplierOrderId, orderId).run();
    return Response.json({ ok: true, ae_order_id: supplierOrderId, message: 'Supplier order submitted successfully.' });
  } catch (error) {
    // A network/runtime error can happen after AliExpress accepts an order. Do not auto-retry.
    try {
      const body = await Promise.resolve(null);
      void body;
    } catch (_) {}
    return Response.json({ error: 'Could not confirm the supplier order. Check AliExpress order history before retrying.' }, { status: 500 });
  }
}

async function ensureColumns(env) {
  const statements = [
    'ALTER TABLE orders ADD COLUMN ae_order_id TEXT',
    'ALTER TABLE orders ADD COLUMN ae_status TEXT',
    'ALTER TABLE products ADD COLUMN ae_product_id TEXT',
    'ALTER TABLE products ADD COLUMN ae_sku_attr TEXT'
  ];
  for (const sql of statements) { try { await env.DB.prepare(sql).run(); } catch (_) {} }
}

function normalizePhone(value) {
  let phone = String(value || '').replace(/[^0-9+]/g, '');
  if (phone.startsWith('+234')) phone = phone.slice(4);
  else if (phone.startsWith('234')) phone = phone.slice(3);
  if (phone.startsWith('0')) phone = phone.slice(1);
  return phone;
}

function safeText(value) {
  return String(value || 'Product').replace(/[<>]/g, '').slice(0, 80);
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
  const gateways = ['https://api-sg.aliexpress.com/sync', 'https://api-sg.aliexpress.com/rest'];
  let lastError = 'AliExpress API request failed';
  for (const gateway of gateways) {
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
