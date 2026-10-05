export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const rawUrl = String(body.url || '').trim();
    const status = body.status || 'pending';
    const sellerId = body.seller_id || null;

    if (!rawUrl) {
      return Response.json({ error: 'url is required' }, { status: 400 });
    }

    const productId = extractProductId(rawUrl);
    if (!productId) {
      return Response.json({ error: 'Could not find AliExpress product id in URL' }, { status: 400 });
    }

    const appKey = env.AE_APP_KEY;
    const appSecret = env.AE_APP_SECRET;
    const accessToken = env.AE_ACCESS_TOKEN || '';

    if (!appKey || !appSecret) {
      return Response.json({ error: 'AE_APP_KEY and AE_APP_SECRET must be set' }, { status: 500 });
    }
    if (!accessToken) {
      return Response.json({ error: 'AE_ACCESS_TOKEN must be set' }, { status: 500 });
    }

    let detail = null;
    let source = 'aliexpress_ds';

    // 1) Dropshipping product API
    detail = await callIop(env, 'aliexpress.ds.product.get', {
      product_id: productId,
      ship_to_country: 'NG',
      target_currency: 'USD',
      target_language: 'en',
      access_token: accessToken
    });

    // 2) Affiliate fallback
    if (!detail || detail.error) {
      source = 'aliexpress_affiliate';
      const affParams = {
        product_ids: productId,
        target_currency: 'USD',
        target_language: 'EN',
        access_token: accessToken
      };
      if (env.AE_TRACKING_ID) affParams.tracking_id = env.AE_TRACKING_ID;

      detail = await callIop(env, 'aliexpress.affiliate.productdetail.get', affParams);
    }

    if (!detail || detail.error) {
      return Response.json({
        error: (detail && detail.error) || 'AliExpress API returned no data',
        raw: detail && detail.raw ? detail.raw : null
      }, { status: 502 });
    }

    const mapped = mapProduct(detail, productId, rawUrl, env);
    if (!mapped.name) {
      // Temporary debug: top-level keys + a small sample (no secrets)
      var raw = detail.raw || {};
      var topKeys = Object.keys(raw);
      var sample = JSON.stringify(raw).slice(0, 1500);
      return Response.json({
        error: 'Could not map product title from API response',
        top_keys: topKeys,
        sample: sample
      }, { status: 502 });
    }

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        old_price REAL DEFAULT 0,
        category TEXT,
        image TEXT,
        stock INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        seller_id TEXT,
        source TEXT,
        source_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    try { await env.DB.prepare('ALTER TABLE products ADD COLUMN source TEXT').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE products ADD COLUMN source_url TEXT').run(); } catch (e) {}

    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO products (
        id, name, description, price, old_price, category, image,
        stock, status, seller_id, source, source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      mapped.name,
      mapped.description,
      mapped.price,
      mapped.old_price,
      mapped.category,
      mapped.image,
      mapped.stock,
      status,
      sellerId,
      source,
      mapped.source_url
    ).run();

    return Response.json({
      ok: true,
      message: 'Product imported from AliExpress',
      id: id,
      product: mapped,
      api_source: source
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function extractProductId(url) {
  var m = url.match(/\/item\/(\d+)/i);
  if (m) return m[1];
  m = url.match(/[?&]productIds?=(\d+)/i);
  if (m) return m[1];
  if (/^\d{10,}$/.test(url)) return url;
  return null;
}

async function callIop(env, methodName, businessParams) {
  // Business API sign path = method name (IOP)
  var params = {
    method: methodName,
    app_key: String(env.AE_APP_KEY),
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    format: 'json',
    v: '2.0'
  };

  for (var k in businessParams) {
    if (businessParams[k] !== undefined && businessParams[k] !== null && String(businessParams[k]) !== '') {
      params[k] = String(businessParams[k]);
    }
  }

  // Some AE docs use "session" instead of "access_token"
  if (params.access_token && !params.session) {
    params.session = params.access_token;
  }

  params.sign = await iopSign(methodName, params, env.AE_APP_SECRET);

  var formBody = toForm(params);
  var gateways = [
    'https://api-sg.aliexpress.com/sync',
    'https://api-sg.aliexpress.com/rest'
  ];

  var lastError = null;
  var lastRaw = null;

  for (var i = 0; i < gateways.length; i++) {
    try {
      var res = await fetch(gateways[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: formBody
      });
      var raw = await res.json();
      lastRaw = raw;

      if (raw.error_response) {
        lastError = raw.error_response.sub_msg || raw.error_response.msg || raw.error_response.code || 'API error';
        continue;
      }

      return { raw: raw, error: null };
    } catch (e) {
      lastError = e.message;
    }
  }

  return { error: lastError || 'Request failed', raw: lastRaw };
}

async function iopSign(apiPath, params, secret) {
  var keys = Object.keys(params).sort();
  var str = apiPath;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === 'sign') continue;
    var v = params[k];
    if (v === undefined || v === null || String(v) === '') continue;
    str += k + String(v);
  }

  var keyData = new TextEncoder().encode(secret);
  var cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  var sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(str));
  return bufToHex(sigBuf).toUpperCase();
}

function bufToHex(buf) {
  var bytes = new Uint8Array(buf);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var h = bytes[i].toString(16);
    out += (h.length === 1 ? '0' : '') + h;
  }
  return out;
}

function toForm(obj) {
  var parts = [];
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    parts.push(encodeURIComponent(keys[i]) + '=' + encodeURIComponent(String(obj[keys[i]])));
  }

  function mapProduct(detail, productId, rawUrl, env) {
  var raw = detail.raw || {};
  var rate = Number(env.AE_USD_TO_NGN) || 1600;
  var markup = Number(env.AE_MARKUP) || 1.3;

  // Prefer official DS paths
  var result =
    dig(raw, ['aliexpress_ds_product_get_response', 'result']) ||
    dig(raw, ['result']) ||
    null;

  var base =
    dig(result, ['ae_item_base_info_dto']) ||
    result ||
    {};

  // Affiliate shapes
  var aff =
    dig(raw, ['aliexpress_affiliate_productdetail_get_response', 'resp_result', 'result', 'products', 'product']) ||
    dig(raw, ['aliexpress_affiliate_productdetail_get_response', 'resp_result', 'result']);

  if (Array.isArray(aff) && aff.length) aff = aff[0];
  if (aff && aff.products && Array.isArray(aff.products.product)) aff = aff.products.product[0];
  if (aff && Array.isArray(aff.product)) aff = aff.product[0];

  var name =
    base.subject ||
    base.product_title ||
    base.title ||
    (aff && (aff.product_title || aff.subject || aff.title)) ||
    deepFindString(raw, ['subject', 'product_title', 'title', 'product_title_name']) ||
    '';

  var usdPrice = Number(
    base.target_sale_price || base.sale_price || base.min_price || 0
  );

  if (!usdPrice && aff) {
    usdPrice = Number(aff.target_sale_price || aff.sale_price || aff.product_price || aff.target_app_sale_price || 0);
  }

  // SKU prices (DS)
  if (!usdPrice && result) {
    var skus =
      dig(result, ['ae_item_sku_info_dtos', 'ae_item_sku_info_d_t_o']) ||
      dig(result, ['ae_item_sku_info_dtos']) ||
      [];
    if (!Array.isArray(skus)) skus = [skus];
    for (var i = 0; i < skus.length; i++) {
      var p = Number(skus[i] && (skus[i].offer_sale_price || skus[i].sku_price || skus[i].sku_price_cent || 0));
      if (p > 0) { usdPrice = p; break; }
    }
  }

  // Sometimes price is in cents as string
  if (usdPrice > 10000 && String(usdPrice).indexOf('.') === -1) {
    usdPrice = usdPrice / 100;
  }

  var usdOld = Number(
    base.target_original_price || base.original_price ||
    (aff && (aff.target_original_price || aff.original_price)) || 0
  );

  var priceNgn = Math.round(usdPrice * rate * markup);
  var oldNgn = usdOld ? Math.round(usdOld * rate * markup) : 0;

  var image =
    dig(result, ['ae_multimedia_info_dto', 'image_urls']) ||
    base.product_main_image_url ||
    (aff && (aff.product_main_image_url || aff.product_image || aff.image_url)) ||
    '';

  if (typeof image === 'string' && image.indexOf(';') !== -1) {
    image = image.split(';')[0].trim();
  }
  if (typeof image === 'string' && image.indexOf(',') !== -1 && image.indexOf('http') === 0) {
    image = image.split(',')[0].trim();
  }
  if (!image && aff && aff.product_small_image_urls) {
    var imgs = aff.product_small_image_urls.string || aff.product_small_image_urls;
    if (Array.isArray(imgs) && imgs[0]) image = imgs[0];
  }
  if (!image) {
    image = deepFindString(raw, ['image_urls', 'product_main_image_url', 'main_image']) || '';
    if (image.indexOf(';') !== -1) image = image.split(';')[0].trim();
  }

  var description =
    base.detail ||
    base.product_description ||
    (aff && aff.product_description) ||
    ('Imported from AliExpress #' + productId);

  // Strip simple HTML tags for description length
  if (typeof description === 'string') {
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    name: String(name || '').slice(0, 200),
    description: String(description || '').slice(0, 4000),
    price: priceNgn || 0,
    old_price: oldNgn || 0,
    category: 'imported',
    image: image || '',
    stock: 20,
    source_url: rawUrl.indexOf('http') === 0
      ? rawUrl.split('?')[0]
      : ('https://www.aliexpress.com/item/' + productId + '.html'),
    aliexpress_id: productId,
    cost_usd: usdPrice
  };
}

function deepFindString(obj, keys, depth) {
  if (depth === undefined) depth = 0;
  if (!obj || typeof obj !== 'object' || depth > 8) return '';
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      var a = deepFindString(obj[i], keys, depth + 1);
      if (a) return a;
    }
    return '';
  }
  for (var k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    var v = obj[k];
    if (keys.indexOf(k) !== -1 && typeof v === 'string' && v.trim().length > 2) {
      return v.trim();
    }
    if (v && typeof v === 'object') {
      var f = deepFindString(v, keys, depth + 1);
      if (f) return f;
    }
  }
  return '';
      }

function dig(obj, path) {
  var cur = obj;
  for (var i = 0; i < path.length; i++) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[path[i]];
  }
  return cur || null;
      }
