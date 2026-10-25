/* Extracted script 1 from verify.html */
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