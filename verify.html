<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Email – Davilanco</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/images/logo.jpg">
  <style>
    :root {
      --gold: #FFD700; --bg: #000; --text: #fff;
      --grey: #1a1a1a; --border: #333;
    }
    [data-theme="light"] {
      --bg: #fff; --text: #001F3F; --grey: #f4f4f4; --border: #e0e0e0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; display: flex; flex-direction: column;
    }
    header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 2px solid var(--gold);
    }
    header img { height: 32px; }
    .icon-btn {
      background: none; border: none; font-size: 20px;
      color: var(--text); cursor: pointer; padding: 6px;
    }
    main {
      flex: 1; padding: 24px 16px; max-width: 400px; margin: 0 auto; width: 100%;
    }
    h1 { font-size: 1.5rem; margin-bottom: 6px; }
    .subtitle { font-size: 0.9rem; opacity: 0.75; margin-bottom: 20px; }
    input {
      width: 100%; padding: 14px 16px; border-radius: 10px;
      border: 1px solid var(--border); background: var(--grey);
      color: var(--text); font-size: 15px; margin-bottom: 12px;
    }
    button {
      width: 100%; padding: 14px; background: var(--gold); color: #000;
      border: none; border-radius: 10px; font-weight: 700; font-size: 15px;
      cursor: pointer; margin-bottom: 10px;
    }
    button.secondary {
      background: transparent; border: 1px solid var(--border); color: var(--text);
    }
    #msg { text-align: center; font-size: 14px; margin-top: 8px; }
    .error { color: #e74c3c; }
    .success { color: #27ae60; }
    footer {
      text-align: center; padding: 18px; font-size: 13px;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <header>
    <a href="/"><img src="/images/logo.jpg" alt="Davilanco"></a>
    <button class="icon-btn" type="button" onclick="toggleTheme()">🌓</button>
  </header>

  <main>
    <h1>Verify Email</h1>
    <p class="subtitle">Enter the 6-digit code sent to your email</p>

    <input type="email" id="email" placeholder="Your email *">
    <input type="text" id="code" placeholder="6-digit code *" maxlength="6" inputmode="numeric">
    <button type="button" id="verifyBtn" onclick="confirmCode()">Verify</button>
    <button type="button" class="secondary" onclick="resendCode()">Resend code</button>
    <p id="msg"></p>
    <p style="text-align:center;margin-top:16px;font-size:14px">
      <a href="/login.html" style="color:var(--gold)">Back to Login</a>
    </p>
  </main>

  <footer>Davilanco © 2026</footer>

  <script>
    var savedTheme = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    }

    var params = new URLSearchParams(window.location.search);
    if (params.get('email')) {
      document.getElementById('email').value = params.get('email');
    }

    async function confirmCode() {
      var msg = document.getElementById('msg');
      var email = document.getElementById('email').value.trim();
      var code = document.getElementById('code').value.trim();
      if (!email || !code) {
        msg.className = 'error';
        msg.textContent = 'Email and code required';
        return;
      }
      try {
        var res = await fetch('/api/confirm-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, code: code })
        });
        var data = await res.json();
        if (data.ok) {
          msg.className = 'success';
          msg.textContent = data.message || 'Verified!';
          setTimeout(function() {
            window.location.href = '/login.html';
          }, 1200);
        } else {
          msg.className = 'error';
          msg.textContent = data.error || 'Verification failed';
        }
      } catch (e) {
        msg.className = 'error';
        msg.textContent = 'Network error';
      }
    }

    async function resendCode() {
      var msg = document.getElementById('msg');
      var email = document.getElementById('email').value.trim();
      if (!email) {
        msg.className = 'error';
        msg.textContent = 'Enter your email first';
        return;
      }
      try {
        var res = await fetch('/api/resend-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        var data = await res.json();
        if (data.ok) {
          msg.className = 'success';
          msg.textContent = 'New code sent. Check your inbox.';
        } else {
          msg.className = 'error';
          msg.textContent = data.error || 'Could not resend';
        }
      } catch (e) {
        msg.className = 'error';
        msg.textContent = 'Network error';
      }
    }
  </script>
</body>
</html>
