/* Extracted script 1 from login.html */
var savedTheme = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    }

    function toggleNav() {
      document.getElementById('navDrawer').classList.toggle('open');
    }

    function togglePasswordVisibility(fieldId) {
      var field = document.getElementById(fieldId);
      var newType = field.type === 'password' ? 'text' : 'password';
      field.type = newType;
    }

    var urlParams = new URLSearchParams(window.location.search);
    var redirectTo = urlParams.get('redirect') || '/dashboard.html';

    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var msg = document.getElementById('msg');
      var btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = 'Logging in...';
      msg.textContent = '';

      try {
        var res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: document.getElementById('login').value.trim(),
            password: document.getElementById('password').value
          })
        });
        var data = await res.json();

        if (data.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          msg.className = 'success';
          msg.textContent = 'Login successful! Redirecting...';
          setTimeout(() => window.location.href = redirectTo, 500);
        } else if (data.needs_verification) {
          msg.className = 'error';
          msg.innerHTML = data.error + ' <br><a href="/verify.html?email=' + encodeURIComponent(data.email) + '" style="color:var(--gold)">Verify now</a>';
        } else {
          msg.className = 'error';
          msg.textContent = data.error || 'Login failed';
          btn.disabled = false;
          btn.textContent = 'Login';
        }
      } catch (e) {
        msg.className = 'error';
        msg.textContent = 'Network error: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'Login';
      }
    });