var savedTheme = localStorage.getItem('theme');
document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}
function toggleNav() { document.getElementById('navDrawer').classList.toggle('open'); }
function togglePasswordVisibility(fieldId) {
  var field = document.getElementById(fieldId);
  field.type = field.type === 'password' ? 'text' : 'password';
}

var referralParams = new URLSearchParams(window.location.search);
var referralFromUrl = referralParams.get('ref');
if (referralFromUrl) localStorage.setItem('davilanco_referral_code', referralFromUrl.trim().toUpperCase());
var referralInput = document.getElementById('referralCode');
referralInput.value = (referralFromUrl || localStorage.getItem('davilanco_referral_code') || '').trim().toUpperCase();

document.getElementById('signupForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var msg = document.getElementById('msg');
  var btn = document.getElementById('submitBtn');
  var password = document.getElementById('password').value;
  var password2 = document.getElementById('password2').value;

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    msg.className = 'error';
    msg.textContent = 'Password must be 8+ chars with uppercase, number and symbol';
    return;
  }
  if (password !== password2) {
    msg.className = 'error';
    msg.textContent = 'Passwords do not match';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating...';
  msg.textContent = '';

  try {
    var res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstname: document.getElementById('firstname').value.trim(),
        lastname: document.getElementById('lastname').value.trim(),
        nickname: document.getElementById('nickname').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        referral_code: referralInput.value.trim().toUpperCase(),
        password: password
      })
    });
    var data = await res.json();

    if (data.ok) {
      localStorage.removeItem('davilanco_referral_code');
      msg.className = 'success';
      msg.innerHTML = 'Account created! Check your email for verification code. <br><a href="/verify.html" style="color:var(--gold)">Verify now</a>';
      document.getElementById('signupForm').reset();
      btn.textContent = 'Account Created';
    } else {
      msg.className = 'error';
      msg.textContent = data.error || 'Signup failed';
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  } catch (e) {
    msg.className = 'error';
    msg.textContent = 'Network error: ' + e.message;
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});
