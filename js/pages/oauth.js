/* Extracted script 1 from oauth.html */
var params = new URLSearchParams(location.search);
    var code = params.get('code') || '';
    var err = params.get('error') || '';
    var status = document.getElementById('status');

    if (err) {
      status.className = 'err';
      status.textContent = 'AliExpress error: ' + err;
    } else if (code) {
      status.className = 'ok';
      status.textContent = 'Code received. Copy it or click Get Access Token.';
      document.getElementById('codeBox').value = code;
    } else {
      status.textContent = 'No code yet. Set this page as Callback URL, then authorize.';
      // Build authorize link if user pastes app key manually later; for now show instructions
      status.innerHTML += '<br><br>Callback URL for AliExpress app:<br><code>https://shop.davilanco.com/oauth.html</code>';
    }

    function copyCode() {
      var t = document.getElementById('codeBox');
      t.select();
      document.execCommand('copy');
      alert('Code copied');
    }

    async function getToken() {
      var c = document.getElementById('codeBox').value.trim();
      var ts = document.getElementById('tokenStatus');
      if (!c) {
        ts.className = 'err';
        ts.textContent = 'No code';
        return;
      }
      ts.textContent = 'Requesting token…';
      try {
        var res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ae_token', code: c })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        document.getElementById('accessBox').value = data.access_token || '';
        document.getElementById('refreshBox').value = data.refresh_token || '';
        ts.className = 'ok';
        ts.textContent = 'Success. Copy tokens into Cloudflare env, then redeploy.';
      } catch (e) {
        ts.className = 'err';
        ts.textContent = e.message || 'Failed';
      }
    }