export async function onRequest(context) {
  try {
    var env = context.env || {};
    var url = new URL(context.request.url);
    var code = url.searchParams.get('code') || '';
    var err = url.searchParams.get('error') || '';
    var appKey = env.AE_APP_KEY || '';
    var appSecret = env.AE_APP_SECRET || '';
    var callback = 'https://shop.davilanco.com/api/ae-callback';

    if (err) {
      return html('AliExpress error', '<p style="color:#e74c3c">' + esc(err) + '</p>');
    }

    if (!code) {
      var body = '<p><b>Callback is live.</b></p>';
      body += '<p>Callback URL:</p><code>' + esc(callback) + '</code>';
      if (appKey) {
        var auth =
          'https://api-sg.aliexpress.com/oauth/authorize'
          + '?response_type=code'
          + '&client_id=' + encodeURIComponent(appKey)
          + '&redirect_uri=' + encodeURIComponent(callback)
          + '&state=davilanco&view=web&sp=ae';
        body += '<p style="margin-top:16px"><a style="color:#FFD700" href="' + auth + '">Authorize AliExpress</a></p>';
      } else {
        body += '<p style="color:#e74c3c">AE_APP_KEY not set.</p>';
      }
      body += '<p style="opacity:0.7;font-size:13px;margin-top:12px">Code expires in ~3 minutes. Authorize, then wait for token page.</p>';
      return html('AliExpress OAuth', body);
    }

    if (!appKey || !appSecret) {
      return html('Missing env', '<p>Set AE_APP_KEY and AE_APP_SECRET.</p><p>Code: ' + esc(code.slice(0, 16)) + '...</p>');
    }

    var result = await createToken(appKey, appSecret, code);

    if (!result.ok) {
      return html(
        'Token failed',
        '<p style="color:#e74c3c">' + esc(result.error || 'failed') + '</p>'
        + '<pre style="background:#111;padding:12px;overflow:auto;font-size:12px">'
        + esc(JSON.stringify(result.raw || {}, null, 2))
        + '</pre>'
      );
    }

    return html(
      'Token OK',
      '<p style="color:#27ae60">Copy into Cloudflare env → Redeploy</p>'
      + '<p><b>AE_ACCESS_TOKEN</b></p>'
      + '<textarea readonly style="width:100%;height:90px;background:#111;color:#fff;border:1px solid #333;padding:10px">'
      + esc(result.access_token || '')
      + '</textarea>'
      + '<p><b>AE_REFRESH_TOKEN</b></p>'
      + '<textarea readonly style="width:100%;height:90px;background:#111;color:#fff;border:1px solid #333;padding:10px">'
      + esc(result.refresh_token || '')
      + '</textarea>'
    );
  } catch (e) {
    return html('Error', '<p style="color:#e74c3c">' + esc(e.message || String(e)) + '</p>');
  }
}

async function createToken(appKey, appSecret, code) {
  // IOP system API path
  var apiPath = '/auth/token/create';

  // Common + business params (NO "method", NO "sign" yet)
  var params = {
    app_key: String(appKey),
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    code: String(code)
  };

  // Correct IOP sign: HMAC-SHA256( apiPath + sorted key+value, secret )
  params.sign = await iopSign(apiPath, params, appSecret);

  var formBody = toForm(params);

  // System auth endpoint styles used by AE
  var urls = [
    'https://api-sg.aliexpress.com/rest' + apiPath,
    'https://api-sg.aliexpress.com/rest'
  ];

  var lastRaw = null;
  var lastErr = 'no response';

  for (var i = 0; i < urls.length; i++) {
    try {
      var res = await fetch(urls[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: formBody
      });
      var raw = await res.json();
      lastRaw = raw;

      if (raw && raw.error_response) {
        lastErr = raw.error_response.sub_msg || raw.error_response.msg || raw.error_response.code || 'error_response';
        continue;
      }

      var access = findKey(raw, 'access_token');
      if (access) {
        return {
          ok: true,
          access_token: access,
          refresh_token: findKey(raw, 'refresh_token') || '',
          raw: raw
        };
      }
      lastErr = 'no access_token in response';
    } catch (e) {
      lastErr = e.message;
    }
  }

  return { ok: false, error: lastErr, raw: lastRaw || {} };
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

  // HMAC-SHA256 with app secret as key
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

function findKey(obj, key) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj[key]) return String(obj[key]);
  var ks = Object.keys(obj);
  for (var i = 0; i < ks.length; i++) {
    var v = obj[ks[i]];
    if (v && typeof v === 'object') {
      var f = findKey(v, key);
      if (f) return f;
    }
    if (typeof v === 'string' && (ks[i] === 'token_result' || ks[i] === 'result')) {
      try {
        var p = JSON.parse(v);
        if (p && p[key]) return String(p[key]);
      } catch (e) {}
    }
  }
  return '';
}

function toForm(obj) {
  var parts = [];
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    parts.push(encodeURIComponent(keys[i]) + '=' + encodeURIComponent(String(obj[keys[i]])));
  }
  return parts.join('&');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function html(title, body) {
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + esc(title) + '</title>'
    + '<style>body{font-family:system-ui;background:#000;color:#fff;padding:24px;max-width:640px;margin:0 auto}'
    + 'code{color:#C4FF61;word-break:break-all}a{color:#FFD700}textarea{width:100%}</style></head><body>'
    + '<h1 style="color:#FFD700">' + esc(title) + '</h1>' + body + '</body></html>';
  return new Response(h, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
