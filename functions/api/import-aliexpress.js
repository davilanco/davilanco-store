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
      return Response.json({
        error: 'Could not find AliExpress product id in URL'
      }, { status: 400 });
    }

    const appKey = env.AE_APP_KEY;
    const appSecret = env.AE_APP_SECRET;
    const session = env.AE_ACCESS_TOKEN || '';

    if (!appKey || !appSecret) {
      return Response.json({
        error: 'AE_APP_KEY and AE_APP_SECRET must be set'
      }, { status: 500 });
    }

    // 1) Try Dropshipping product API
    let detail = null;
    let source = 'aliexpress_ds';

    if (session) {
      detail = await callAliExpress(env, {
        method: 'aliexpress.ds.product.get',
        product_id: productId,
        ship_to_country: 'NG',
        target_currency: 'USD',
        target_language: 'en',
        session: session
      });
    }

    // 2) Fallback: Affiliate product detail
    if (!detail || detail.error) {
      source = 'aliexpress_affiliate';
      detail = await callAliExpress(env, {
        method: 'aliexpress.affiliate.productdetail.get',
        product_ids: productId,
        target_currency: 'USD',
        target_language: 'EN',
        tracking_id: env.AE_TRACKING_ID || undefined
      });
    }

    if (!detail || detail.error) {
      return Response.json({
        error: detail && detail.error ? detail.error : 'AliExpress API returned no data',
        raw: detail && detail.raw ? detail.raw : null
      }, { status: 502 });
    }

    const mapped = mapProduct(detail, productId, rawUrl, env);
    if (!mapped.name) {
      return Response.json({
        error: 'Could not map product title from API response',
        raw: detail.raw
      }, { status: 502 });
    }

    // Ensure products table columns
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
  // https://www.aliexpress.com/item/100500123.html
  var m = url.match(/\/item\/(\d+)/i);
  if (m) return m[1];
  m = url.match(/[?&]productId=(\d+)/i);
  if (m) return m[1];
  // bare id
  if (/^\d{10,}$/.test(url)) return url;
  return null;
}

async function callAliExpress(env, businessParams) {
  const method = businessParams.method;
  const session = businessParams.session;
  delete businessParams.method;
  delete businessParams.session;

  const params = {
    method: method,
    app_key: env.AE_APP_KEY,
    sign_method: 'md5',
    timestamp: formatTimestamp(),
    format: 'json',
    v: '2.0'
  };

  if (session) params.session = session;

  for (const k in businessParams) {
    if (businessParams[k] !== undefined && businessParams[k] !== null && businessParams[k] !== '') {
      params[k] = String(businessParams[k]);
    }
  }

  params.sign = signMd5(params, env.AE_APP_SECRET);

  const body = new URLSearchParams(params);

  // New + legacy gateways
  const gateways = [
    'https://api-sg.aliexpress.com/sync',
    'https://gw.api.taobao.com/router/rest'
  ];

  let lastError = null;
  let lastRaw = null;

  for (let i = 0; i < gateways.length; i++) {
    try {
      const res = await fetch(gateways[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: body.toString()
      });
      const raw = await res.json();
      lastRaw = raw;

      if (raw.error_response) {
        lastError = raw.error_response.msg || raw.error_response.sub_msg || 'API error';
        continue;
      }

      return { raw: raw, error: null };
    } catch (e) {
      lastError = e.message;
    }
  }

  return { error: lastError || 'Request failed', raw: lastRaw };
}

function mapProduct(detail, productId, rawUrl, env) {
  const raw = detail.raw || {};
  const rate = Number(env.AE_USD_TO_NGN) || 1600;
  const markup = Number(env.AE_MARKUP) || 1.3;

  // Try DS response shapes
  let node =
    dig(raw, ['aliexpress_ds_product_get_response', 'result']) ||
    dig(raw, ['aliexpress_ds_product_get_response', 'result', 'ae_item_base_info_dto']) ||
    dig(raw, ['aliexpress_affiliate_productdetail_get_response', 'resp_result', 'result', 'products', 'product']) ||
    dig(raw, ['aliexpress_affiliate_productdetail_get_response', 'resp_result', 'result']);

  // Affiliate often returns array
  if (Array.isArray(node) && node.length) node = node[0];
  if (node && node.products && Array.isArray(node.products.product)) {
    node = node.products.product[0];
  }
  if (node && Array.isArray(node.product)) node = node.product[0];

  node = node || {};

  const name =
    node.subject ||
    node.product_title ||
    node.title ||
    node.product_title_name ||
    '';

  let usdPrice = Number(
    node.target_sale_price ||
    node.sale_price ||
    node.target_app_sale_price ||
    node.product_price ||
    node.min_price ||
    0
  );

  let usdOld = Number(
    node.target_original_price ||
    node.original_price ||
    node.product_original_price ||
    0
  );

  // DS SKU price fallback
  if (!usdPrice) {
    const skus = dig(raw, ['aliexpress_ds_product_get_response', 'result', 'ae_item_sku_info_dtos']) ||
      dig(raw, ['aliexpress_ds_product_get_response', 'result', 'ae_item_sku_info_dtos', 'ae_item_sku_info_d_t_o']);
    const skuList = Array.isArray(skus) ? skus : (skus ? [skus] : []);
    if (skuList[0]) {
      usdPrice = Number(skuList[0].offer_sale_price || skuList[0].sku_price || 0);
    }
  }

  const priceNgn = Math.round(usdPrice * rate * markup);
  const oldNgn = usdOld ? Math.round(usdOld * rate * markup) : 0;

  let image =
    node.product_main_image_url ||
    node.main_image ||
    node.image_url ||
    node.product_image ||
    '';

  if (!image && node.product_small_image_urls) {
    const imgs = node.product_small_image_urls.string || node.product_small_image_urls;
    if (Array.isArray(imgs) && imgs[0]) image = imgs[0];
  }

  const description =
    node.product_description ||
    node.description ||
    ('Imported from AliExpress #' + productId);

  return {
    name: String(name).slice(0, 200),
    description: String(description).slice(0, 4000),
    price: priceNgn || 0,
    old_price: oldNgn || 0,
    category: 'imported',
    image: image,
    stock: 20,
    source_url: rawUrl.indexOf('http') === 0 ? rawUrl : ('https://www.aliexpress.com/item/' + productId + '.html'),
    aliexpress_id: productId,
    cost_usd: usdPrice
  };
}

function dig(obj, path) {
  let cur = obj;
  for (let i = 0; i < path.length; i++) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[path[i]];
  }
  return cur || null;
}

function formatTimestamp() {
  // YYYY-MM-DD HH:mm:ss UTC
  const d = new Date();
  const p = function(n) { return String(n).padStart(2, '0'); };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
}

function signMd5(params, secret) {
  const keys = Object.keys(params).sort();
  let str = secret;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k === 'sign') continue;
    const v = params[k];
    if (v !== undefined && v !== null && String(v) !== '') {
      str += k + String(v);
    }
  }
  str += secret;
  return md5(str).toUpperCase();
}

// Minimal MD5 (Workers have no node crypto md5)
function md5(string) {
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((\~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (\~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (\~d)), a, b, x, s, t); }
  function md5cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  function md5blk(s) {
    var md5blks = [], i;
    for (i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  function md51(s) {
    var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    var tail = new Array(16).fill(0);
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      tail = new Array(16).fill(0);
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function rhex(n) {
    var s = '', j;
    for (j = 0; j < 4; j++) s += ('0' + ((n >> (j * 8)) & 255).toString(16)).slice(-2);
    return s;
  }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  return md51(unescape(encodeURIComponent(string))).map(rhex).join('');
}
