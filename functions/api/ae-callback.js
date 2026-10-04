export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error') || '';

  if (error) {
    return htmlPage('AliExpress error', '<p style="color:#e74c3c">' + escapeHtml(error) + '</p>');
  }

  if (!code) {
    // No code yet — show how to start authorize
    const appKey = env.AE_APP_KEY || '';
    const callback = 'https://shop.davilanco.com/api/ae-callback';
    const authUrl = appKey
      ? 'https://api-sg.aliexpress.com/oauth/authorize?response_type=code'
        + '&client_id=' + encodeURIComponent(appKey)
        + '&redirect_uri=' + encodeURIComponent(callback)
        + '&state=davilanco&view=web&sp=ae'
      : '';

    return htmlPage(
      'AliExpress OAuth',
      '<p>No <code>code</code> yet.</p>'
      + (authUrl
        ? '<p><a href="' + authUrl + '" style="color:#FFD700">Click to authorize AliExpress app</a></p>'
        : '<p style="color:#e74c3c">Set AE_APP_KEY in Cloudflare first.</p>')
      + '<p style="opacity:0.7;font-size:13px">Callback URL for app settings:<br><code>' + callback + '</code></p>'
    );
  }

  // Exchange code for token
  try {
    const appKey = env.AE_APP_KEY;
    const appSecret = env.AE_APP_SECRET;

    if (!appKey || !appSecret) {
      return htmlPage('Missing env', '<p>Set AE_APP_KEY and AE_APP_SECRET, then try again.</p>');
    }

    const tokenResult = await createToken(env, code);

    if (tokenResult.error) {
      return htmlPage(
        'Token failed',
        '<p style="color:#e74c3c">' + escapeHtml(tokenResult.error) + '</p>'
        + '<pre style="font-size:12px;overflow:auto">' + escapeHtml(JSON.stringify(tokenResult.raw || {}, null, 2)) + '</pre>'
      );
    }

    const access = tokenResult.access_token || '';
    const refresh = tokenResult.refresh_token || '';
    const expire = tokenResult.expire_time || tokenResult.expires_in || '';

    return htmlPage(
      'Token OK — copy to Cloudflare',
      '<p style="color:#27ae60">Success. Copy these into Cloudflare Pages → Environment variables, then redeploy.</p>'
      + '<p><strong>AE_ACCESS_TOKEN</strong></p>'
      + '<textarea readonly style="width:100%;height:80px">' + escapeHtml(access) + '</textarea>'
      + '<p><strong>AE_REFRESH_TOKEN</strong> (optional)</p>'
      + '<textarea readonly style="width:100%;height:80px">' + escapeHtml(refresh) + '</textarea>'
      + '<p>Expire: ' + escapeHtml(String(expire)) + '</p>'
      + '<p style="opacity:0.7;font-size:13px">Do not share these. After saving in Cloudflare, you can close this page.</p>'
      + '<pre style="font-size:11px;opacity:0.6;overflow:auto">' + escapeHtml(JSON.stringify(tokenResult.raw || {}, null, 2)) + '</pre>'
    );
  } catch (err) {
    return htmlPage('Error', '<p style="color:#e74c3c">' + escapeHtml(err.message) + '</p>');
  }
}

async function createToken(env, code) {
  // Try common Open Platform token methods
  const attempts = [
    { method: '/auth/token/create', extra: { code: code, grant_type: 'authorization_code' } },
    { method: 'system.oauth2.token.create', extra: { code: code, grant_type: 'authorization_code' } },
    { method: 'aliexpress.system.oauth.token.create', extra: { code: code } }
  ];

  let lastRaw = null;
  let lastError = null;

  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const params = {
      method: a.method,
      app_key: env.AE_APP_KEY,
      sign_method: 'md5',
      timestamp: formatTimestamp(),
      format: 'json',
      v: '2.0',
      ...a.extra
    };
    params.sign = signMd5(params, env.AE_APP_SECRET);

    const gateways = [
      'https://api-sg.aliexpress.com/rest',
      'https://api-sg.aliexpress.com/sync',
      'https://gw.api.taobao.com/router/rest'
    ];

    for (let g = 0; g < gateways.length; g++) {
      try {
        const res = await fetch(gateways[g], {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
          body: new URLSearchParams(params).toString()
        });
        const raw = await res.json();
        lastRaw = raw;

        if (raw.error_response) {
          lastError = raw.error_response.sub_msg || raw.error_response.msg || 'error_response';
          continue;
        }

        // Various response shapes
        const t =
          dig(raw, ['access_token']) ||
          dig(raw, ['token_result', 'access_token']) ||
          dig(raw, ['result', 'access_token']) ||
          dig(raw, ['aliexpress_system_oauth_token_create_response', 'access_token']) ||
          dig(raw, ['/auth/token/create_response', 'access_token']);

        // Sometimes token fields are nested as string JSON
        let parsed = raw;
        const tr = dig(raw, ['token_result']) || dig(raw, ['result']);
        if (typeof tr === 'string') {
          try { parsed = JSON.parse(tr); } catch (e) {}
        } else if (tr && typeof tr === 'object') {
          parsed = tr;
        }

        const access_token = t || parsed.access_token || '';
        if (access_token) {
          return {
            access_token: access_token,
            refresh_token: parsed.refresh_token || '',
            expire_time: parsed.expire_time || parsed.expires_in || '',
            raw: raw
          };
        }

        lastError = 'No access_token in response';
      } catch (e) {
        lastError = e.message;
      }
    }
  }

  return { error: lastError || 'Token exchange failed', raw: lastRaw };
}

function dig(obj, path) {
  let cur = obj;
  for (let i = 0; i < path.length; i++) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[path[i]];
  }
  return cur;
}

function formatTimestamp() {
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
    if (v !== undefined && v !== null && String(v) !== '') str += k + String(v);
  }
  str += secret;
  return md5(str).toUpperCase();
}

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
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function md5blk(s) {
    var md5blks = [], i;
    for (i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
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
    if (i > 55) { md5cycle(state, tail); tail = new Array(16).fill(0); }
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlPage(title, body) {
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + escapeHtml(title) + '</title>'
    + '<style>body{font-family:system-ui;background:#000;color:#fff;padding:24px;max-width:640px;margin:0 auto}'
    + 'textarea{background:#111;color:#fff;border:1px solid #333;border-radius:8px;padding:10px}'
    + 'a{color:#FFD700}code{color:#C4FF61}</style></head><body>'
    + '<h1 style="color:#FFD700">' + escapeHtml(title) + '</h1>'
    + body
    + '</body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
