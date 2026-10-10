export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // --- Optional: exchange OAuth code for token (same file) ---
    if (body && body.action === 'ae_token') {
      return await handleAeToken(env, body.code);
    }

    if (body && body.action === 'ae_search') {
      return await handleAeSearch(env, body);
    }

    if (body && body.action === 'ae_bulk_import') {
      return await handleAeBulkImport(env, body);
    }

    // --- Product import from URL ---
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
      access_token: accessToken,
      session: accessToken
    });

    // 2) Affiliate fallback
    if (!detail || detail.error) {
      source = 'aliexpress_affiliate';
      const affParams = {
        product_ids: productId,
        target_currency: 'USD',
        target_language: 'EN',
        access_token: accessToken,
        session: accessToken
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
      const raw = detail.raw || {};
      return Response.json({
        error: 'Could not map product title from API response',
        top_keys: Object.keys(raw),
        sample: JSON.stringify(raw).slice(0, 1500)
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

// ---------- OAuth token exchange (POST { action: "ae_token", code: "..." }) ----------
async function handleAeToken(env, code) {
  code = String(code || '').trim();
  if (!code) {
    return Response.json({ ok: false, error: 'code required' }, { status: 400 });
  }

  const appKey = env.AE_APP_KEY;
  const appSecret = env.AE_APP_SECRET;
  if (!appKey || !appSecret) {
    return Response.json({ ok: false, error: 'AE_APP_KEY / AE_APP_SECRET not set' }, { status: 500 });
  }

  const apiPath = '/auth/token/create';
  const params = {
    app_key: String(appKey),
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    code: code
  };
  params.sign = await iopSign(apiPath, params, appSecret);

  const formBody = toForm(params);
  const urls = [
    'https://api-sg.aliexpress.com/rest' + apiPath,
    'https://api-sg.aliexpress.com/rest'
  ];

  let lastRaw = null;
  let lastErr = 'no response';

  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: formBody
      });
      const raw = await res.json();
      lastRaw = raw;

      if (raw && raw.error_response) {
        lastErr = raw.error_response.sub_msg || raw.error_response.msg || raw.error_response.code || 'error';
        continue;
      }

      const access = deepFindString(raw, ['access_token']);
      if (access) {
        return Response.json({
          ok: true,
          access_token: access,
          refresh_token: deepFindString(raw, ['refresh_token']) || '',
          raw: raw
        });
      }
      lastErr = 'no access_token in response';
    } catch (e) {
      lastErr = e.message;
    }
  }

  return Response.json({ ok: false, error: lastErr, raw: lastRaw || {} }, { status: 502 });
}

async function handleAeSearch(env, body) {
  var keywords = String(body.keywords || body.q || '').trim();
  var page = Number(body.page || 1) || 1;
  if (!keywords) {
    return Response.json({ error: 'keywords required' }, { status: 400 });
  }

  var accessToken = env.AE_ACCESS_TOKEN || '';
  var detail = await callIop(env, 'aliexpress.affiliate.product.query', {
    keywords: keywords,
    page_no: String(page),
    page_size: '20',
    sort: 'LAST_VOLUME_DESC',
    target_currency: 'USD',
    target_language: 'EN',
    ship_to_country: 'NG',
    tracking_id: env.AE_TRACKING_ID || undefined,
    access_token: accessToken || undefined,
    session: accessToken || undefined
  });

  if (detail.error) {
    return Response.json({ error: detail.error, raw: detail.raw }, { status: 502 });
  }

  var raw = detail.raw || {};
  var list =
    dig(raw, ['aliexpress_affiliate_product_query_response', 'resp_result', 'result', 'products', 'product']) ||
    dig(raw, ['aliexpress_affiliate_product_query_response', 'resp_result', 'result', 'products']) ||
    [];

  if (!Array.isArray(list)) list = list ? [list] : [];

  var rate = Number(env.AE_USD_TO_NGN) || 1600;
  var markup = Number(env.AE_MARKUP) || 1.3;

  var items = list.map(function (p) {
    var usd = Number(p.target_sale_price || p.sale_price || p.product_price || 0);
    return {
      product_id: String(p.product_id || p.productId || ''),
      title: p.product_title || p.subject || p.title || '',
      image: p.product_main_image_url || p.product_image || '',
      price_usd: usd,
      price_ngn: Math.round(usd * rate * markup),
      url: p.product_detail_url || ('https://www.aliexpress.com/item/' + (p.product_id || p.productId || '') + '.html')
    };
  }).filter(function (x) { return x.product_id; });

  return Response.json({ ok: true, items: items, count: items.length });
}

async function handleAeBulkImport(env, body) {
  var ids = body.product_ids || body.ids || [];
  if (!Array.isArray(ids) || !ids.length) {
    return Response.json({ error: 'product_ids array required' }, { status: 400 });
  }

  var accessToken = env.AE_ACCESS_TOKEN || '';
  var results = [];

  for (var i = 0; i < ids.length && i < 10; i++) {
    var pid = String(ids[i]);
    var url = 'https://www.aliexpress.com/item/' + pid + '.html';
    try {
      var detail = await callIop(env, 'aliexpress.ds.product.get', {
        product_id: pid,
        ship_to_country: 'NG',
        target_currency: 'USD',
        target_language: 'en',
        access_token: accessToken,
        session: accessToken
      });
      if (detail.error) {
        detail = await callIop(env, 'aliexpress.affiliate.productdetail.get', {
          product_ids: pid,
          target_currency: 'USD',
          target_language: 'EN',
          access_token: accessToken,
          session: accessToken,
          tracking_id: env.AE_TRACKING_ID || undefined
        });
      }
      if (detail.error) {
        results.push({ product_id: pid, ok: false, error: detail.error });
        continue;
      }
      var mapped = mapProduct(detail, pid, url, env);
      if (!mapped.name) {
        results.push({ product_id: pid, ok: false, error: 'map failed' });
        continue;
      }
      var id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO products (
          id, name, description, price, old_price, category, image,
          stock, status, seller_id, source, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, mapped.name, mapped.description, mapped.price, mapped.old_price,
        mapped.category, mapped.image, mapped.stock, body.status || 'pending',
        null, 'aliexpress_search', mapped.source_url
      ).run();
      results.push({ product_id: pid, ok: true, id: id, name: mapped.name });
    } catch (e) {
      results.push({ product_id: pid, ok: false, error: e.message });
    }
  }

  return Response.json({ ok: true, results: results });
                              }

// ---------- helpers ----------
function extractProductId(url) {
  var m = url.match(/\/item\/(\d+)/i);
  if (m) return m[1];
  m = url.match(/[?&]productIds?=(\d+)/i);
  if (m) return m[1];
  if (/^\d{10,}$/.test(url)) return url;
  return null;
}

async function callIop(env, methodName, businessParams) {
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
  return parts.join('&');
}

function dig(obj, path) {
  var cur = obj;
  for (var i = 0; i < path.length; i++) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[path[i]];
  }
  return cur == null ? null : cur;
}

function deepFindString(obj, keys, depth) {
  if (depth === undefined) depth = 0;
  if (!obj || typeof obj !== 'object' || depth > 10) return '';
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

function mapProduct(detail, productId, rawUrl, env) {
  var raw = detail.raw || {};
  var rate = Number(env.AE_USD_TO_NGN) || 1600;
  var markup = Number(env.AE_MARKUP) || 1.3;

  var result =
    dig(raw, ['aliexpress_ds_product_get_response', 'result']) ||
    dig(raw, ['result']) ||
    null;

  var base =
    dig(result, ['ae_item_base_info_dto']) ||
    {};

  var aff =
    dig(raw, ['aliexpress_affiliate_productdetail_get_response', 'resp_result', 'result', 'products', 'product']) ||
    dig(raw, ['aliexpress_affiliate_productdetail_get_response', 'resp_result', 'result']);

  if (Array.isArray(aff) && aff.length) aff = aff[0];
  if (aff && aff.products && Array.isArray(aff.products.product)) aff = aff.products.product[0];
  if (aff && Array.isArray(aff.product)) aff = aff.product[0];

  var name =
    (base && base.subject) ||
    (base && base.product_title) ||
    (base && base.title) ||
    (aff && (aff.product_title || aff.subject || aff.title)) ||
    deepFindString(raw, ['subject', 'product_title', 'title', 'product_title_name']) ||
    '';

  var usdPrice = Number(
    (base && (base.target_sale_price || base.sale_price || base.min_price)) || 0
  );

  if (!usdPrice && aff) {
    usdPrice = Number(aff.target_sale_price || aff.sale_price || aff.product_price || aff.target_app_sale_price || 0);
  }

  if (!usdPrice && result) {
    var skus =
      dig(result, ['ae_item_sku_info_dtos', 'ae_item_sku_info_d_t_o']) ||
      dig(result, ['ae_item_sku_info_dtos']) ||
      [];
    if (!Array.isArray(skus)) skus = [skus];
    for (var i = 0; i < skus.length; i++) {
      if (!skus[i]) continue;
      var p = Number(skus[i].offer_sale_price || skus[i].sku_price || 0);
      if (p > 0) {
        usdPrice = p;
        break;
      }
    }
  }

  if (usdPrice > 10000 && String(usdPrice).indexOf('.') === -1) {
    usdPrice = usdPrice / 100;
  }

  var usdOld = Number(
    (base && (base.target_original_price || base.original_price)) ||
    (aff && (aff.target_original_price || aff.original_price)) ||
    0
  );

  var priceNgn = Math.round(usdPrice * rate * markup);
  var oldNgn = usdOld ? Math.round(usdOld * rate * markup) : 0;

  var image =
    dig(result, ['ae_multimedia_info_dto', 'image_urls']) ||
    (base && base.product_main_image_url) ||
    (aff && (aff.product_main_image_url || aff.product_image || aff.image_url)) ||
    deepFindString(raw, ['image_urls', 'product_main_image_url', 'main_image']) ||
    '';

  if (typeof image === 'string') {
    if (image.indexOf(';') !== -1) image = image.split(';')[0].trim();
    else if (image.indexOf(',') !== -1 && image.indexOf('http') === 0) image = image.split(',')[0].trim();
  }

  if (!image && aff && aff.product_small_image_urls) {
    var imgs = aff.product_small_image_urls.string || aff.product_small_image_urls;
    if (Array.isArray(imgs) && imgs[0]) image = imgs[0];
  }

  var description =
    (base && (base.detail || base.product_description)) ||
    (aff && aff.product_description) ||
    ('Imported from AliExpress #' + productId);

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
