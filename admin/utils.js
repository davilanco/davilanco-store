const savedTheme = localStorage.getItem('theme');
document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function toggleNav() {
  document.getElementById('navDrawer').classList.toggle('open');
}

const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
  window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/');
}

let user = {};
try {
  user = JSON.parse(userStr);
} catch (e) {
  localStorage.clear();
  window.location.href = '/login.html';
}

if (user.role !== 'admin') {
  alert('Access denied. Admin only.');
  window.location.href = '/dashboard.html';
}

document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
});
