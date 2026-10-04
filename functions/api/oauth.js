export async function onRequest(context) {
  try {
    var env = context.env || {};
    var url = new URL(context.request.url);
    var code = url.searchParams.get('code') || '';
    var err = url.searchParams.get('error') || '';
    var appKey = env.AE_APP_KEY || '';
    var callback = 'https://shop.davilanco.com/api/oauth';

    if (err) {
      return html('AliExpress error', '<p style="color:#e74c3c">' + esc(err) + '</p>');
    }

    if (!code) {
      var body = '<p><b>OAuth route works.</b></p>';
      body += '<p>Use this as Callback URL in AliExpress:</p>';
      body += '<code>' + esc(callback) + '</code>';

      if (appKey) {
        var auth =
          'https://api-sg.aliexpress.com/oauth/authorize'
          + '?response_type=code'
          + '&client_id=' + encodeURIComponent(appKey)
          + '&redirect_uri=' + encodeURIComponent(callback)
          + '&state=davilanco&view=web&sp=ae';
        body += '<p style="margin-top:16px"><a style="color:#FFD700" href="' + auth + '">Authorize AliExpress</a></p>';
      } else {
        body += '<p style="color:#e74c3c;margin-top:16px">AE_APP_KEY not set in Cloudflare env.</p>';
      }

      return html('AliExpress OAuth', body);
    }

    var appSecret = env.AE_APP_SECRET || '';
    if (!appKey || !appSecret) {
      return html('Missing env', '<p>Set AE_APP_KEY and AE_APP_SECRET.</p>');
    }

    var result = await exchange(appKey, appSecret, code);
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
      '<p style="color:#27ae60">Copy to Cloudflare env, then redeploy.</p>'
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

async function exchange(appKey, appSecret, code) {
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

  try {
    params.sign = await signSha256(params, appSecret);
  } catch (e) {
    return { ok: false, error: 'sign failed: ' + e.message, raw: {} };
  }

  var gateways = [
    'https://api-sg.aliexpress.com/rest',
    'https://api-sg.aliexpress.com/sync'
  ];

  var lastRaw = null;
  var lastErr = 'no response';

  for (var i = 0; i < gateways.length; i++) {
    try {
      var res = await fetch(gateways[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: form(params)
      });
      var raw = await res.json();
      lastRaw = raw;

      if (raw && raw.error_response) {
        lastErr = raw.error_response.sub_msg || raw.error_response.msg || 'error_response';
        continue;
      }

      var access = find(raw, 'access_token');
      if (access) {
        return {
          ok: true,
          access_token: access,
          refresh_token: find(raw, 'refresh_token') || '',
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

function find(obj, key) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj[key]) return String(obj[key]);
  var ks = Object.keys(obj);
  for (var i = 0; i < ks.length; i++) {
    var v = obj[ks[i]];
    if (v && typeof v === 'object') {
      var f = find(v, key);
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

async function signSha256(params, secret) {
  var keys = Object.keys(params).sort();
  var str = secret;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === 'sign') continue;
    var v = params[k];
    if (v !== undefined && v !== null && String(v) !== '') str += k + String(v);
  }
  str += secret;
  var data = new TextEncoder().encode(str);
  var hash = await crypto.subtle.digest('SHA-256', data);
  var bytes = new Uint8Array(hash);
  var out = '';
  for (var j = 0; j < bytes.length; j++) {
    var h = bytes[j].toString(16);
    out += (h.length === 1 ? '0' : '') + h;
  }
  return out.toUpperCase();
}

function ts() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
    + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
}

function form(obj) {
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
    + 'code{color:#C4FF61;word-break:break-all}a{color:#FFD700}</style></head><body>'
    + '<h1 style="color:#FFD700">' + esc(title) + '</h1>' + body + '</body></html>';
  return new Response(h, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
  }
