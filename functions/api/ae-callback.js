export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || '';
    const err = url.searchParams.get('error') || '';
    const appKey = (env && env.AE_APP_KEY) ? env.AE_APP_KEY : '';
    const callback = 'https://shop.davilanco.com/api/ae-callback';

    // Always return something visible (no crash → no homepage fallback)
    if (err) {
      return page('AliExpress error', '<p style="color:#e74c3c">' + esc(err) + '</p>');
    }

    if (!code) {
      var authLink = '';
      if (appKey) {
        authLink =
          'https://api-sg.aliexpress.com/oauth/authorize'
          + '?response_type=code'
          + '&client_id=' + encodeURIComponent(appKey)
          + '&redirect_uri=' + encodeURIComponent(callback)
          + '&state=davilanco'
          + '&view=web'
          + '&sp=ae';
      }

      var body = '<p><strong>Route works.</strong> Callback is live.</p>';
      body += '<p>Callback URL:</p><code>' + esc(callback) + '</code>';

      if (authLink) {
        body += '<p style="margin-top:16px"><a href="' + authLink + '" style="color:#FFD700">Authorize AliExpress app</a></p>';
      } else {
        body += '<p style="color:#e74c3c;margin-top:16px">AE_APP_KEY is missing in Cloudflare env.</p>';
      }

      body += '<p style="opacity:0.7;margin-top:16px;font-size:13px">After AliExpress redirects back with ?code=..., this page will exchange the code for a token.</p>';
      return page('AliExpress OAuth', body);
    }

    // Has code — exchange for token (simple, no fancy MD5 helpers crash risk)
    var appSecret = (env && env.AE_APP_SECRET) ? env.AE_APP_SECRET : '';
    if (!appKey || !appSecret) {
      return page('Missing env', '<p>Set AE_APP_KEY and AE_APP_SECRET, then try again.</p><p>Code received: ' + esc(code.slice(0, 12)) + '...</p>');
    }

    var tokenResult = await exchangeCode(appKey, appSecret, code);

    if (!tokenResult.ok) {
      return page(
        'Token failed',
        '<p style="color:#e74c3c">' + esc(tokenResult.error || 'Unknown error') + '</p>'
        + '<pre style="font-size:12px;overflow:auto;background:#111;padding:12px;border-radius:8px">'
        + esc(JSON.stringify(tokenResult.raw || {}, null, 2))
        + '</pre>'
      );
    }

    return page(
      'Token OK',
      '<p style="color:#27ae60">Copy into Cloudflare → Environment variables → Redeploy</p>'
      + '<p><strong>AE_ACCESS_TOKEN</strong></p>'
      + '<textarea readonly style="width:100%;height:90px;background:#111;color:#fff;border:1px solid #333;padding:10px">'
      + esc(tokenResult.access_token || '')
      + '</textarea>'
      + '<p><strong>AE_REFRESH_TOKEN</strong></p>'
      + '<textarea readonly style="width:100%;height:90px;background:#111;color:#fff;border:1px solid #333;padding:10px">'
      + esc(tokenResult.refresh_token || '')
      + '</textarea>'
      + '<p style="font-size:13px;opacity:0.7">Expire: ' + esc(String(tokenResult.expire || '')) + '</p>'
    );
  } catch (e) {
    return page('Crash caught', '<p style="color:#e74c3c">' + esc(e && e.message ? e.message : String(e)) + '</p>');
  }
}

async function exchangeCode(appKey, appSecret, code) {
  // Official-style token create (signed MD5)
  var params = {
    method: '/auth/token/create',
    app_key: appKey,
    code: code,
    grant_type: 'authorization_code',
    sign_method: 'sha256',
    timestamp: ts(),
    format: 'json',
    v: '2.0'
  };

  // Prefer sha256 via Web Crypto (safe in Workers). Fallback attempts without crash.
  try {
    params.sign = await signSha256(params, appSecret);
  } catch (e) {
    return { ok: false, error: 'Sign failed: ' + e.message, raw: {} };
  }

  var gateways = [
    'https://api-sg.aliexpress.com/rest',
    'https://api-sg.aliexpress.com/sync'
  ];

  var lastRaw = null;
  var lastErr = 'No response';

  for (var i = 0; i < gateways.length; i++) {
    try {
      var res = await fetch(gateways[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: toForm(params)
      });
      var raw = await res.json();
      lastRaw = raw;

      if (raw && raw.error_response) {
        lastErr = raw.error_response.sub_msg || raw.error_response.msg || 'error_response';
        continue;
      }

      var access = findToken(raw, 'access_token');
      var refresh = findToken(raw, 'refresh_token');
      var expire = findToken(raw, 'expire_time') || findToken(raw, 'expires_in');

      if (access) {
        return {
          ok: true,
          access_token: access,
          refresh_token: refresh || '',
          expire: expire || '',
          raw: raw
        };
      }

      lastErr = 'No access_token in response';
    } catch (e) {
      lastErr = e.message;
    }
  }

  return { ok: false, error: lastErr, raw: lastRaw || {} };
}

function findToken(obj, key) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj[key]) return String(obj[key]);

  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v && typeof v === 'object') {
      var found = findToken(v, key);
      if (found) return found;
    }
    if (typeof v === 'string' && (keys[i] === 'token_result' || keys[i] === 'result')) {
      try {
        var parsed = JSON.parse(v);
        if (parsed && parsed[key]) return String(parsed[key]);
      } catch (e) {}
    }
  }
  return '';
}

async function signSha256(params, secret) {
  var keys = Object.keys(params).sort();
  var str = secret;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === 'sign') continue;
    var v = params[k];
    if (v !== undefined && v !== null && String(v) !== '') {
      str += k + String(v);
    }
  }
  str += secret;

  var data = new TextEncoder().encode(str);
  var hash = await crypto.subtle.digest('SHA-256', data);
  return hex(hash).toUpperCase();
}

function hex(buf) {
  var bytes = new Uint8Array(buf);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var h = bytes[i].toString(16);
    out += (h.length === 1 ? '0' : '') + h;
  }
  return out;
}

function ts() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
    + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
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

function page(title, bodyHtml) {
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + esc(title) + '</title>'
    + '<style>body{font-family:system-ui;background:#000;color:#fff;padding:24px;max-width:640px;margin:0 auto}'
    + 'code{color:#C4FF61;word-break:break-all}a{color:#FFD700}</style></head><body>'
    + '<h1 style="color:#FFD700">' + esc(title) + '</h1>'
    + bodyHtml
    + '</body></html>';

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
      }
