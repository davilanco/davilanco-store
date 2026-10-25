/* Extracted script 1 from admin/users.html */
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

    var token = localStorage.getItem('token');
    // Attach the signed session token to every same-origin API request from this admin page.
    (function() {
      var originalFetch = window.fetch.bind(window);
      window.fetch = function(input, init) {
        var target = typeof input === 'string' ? input : (input && input.url) || '';
        if (target.indexOf('/api/') === 0 && token) {
          init = init || {};
          var headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
          headers.set('Authorization', 'Bearer ' + token);
          init = Object.assign({}, init, { headers: headers });
        }
        return originalFetch(input, init);
      };
    })();
    var userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/users.html');
    }
    var adminUser = {};
    try { adminUser = JSON.parse(userStr); } catch (e) {
      localStorage.clear();
      window.location.href = '/login.html';
    }
    if (adminUser.role !== 'admin') {
      alert('Access denied. Admin only.');
      window.location.href = '/dashboard.html';
    }

    document.getElementById('logoutBtn').addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
    });

    function showToast(text) {
      var t = document.getElementById('toast');
      t.textContent = text || 'Done';
      t.style.display = 'block';
      setTimeout(function() { t.style.display = 'none'; }, 1800);
    }

    var allUsers = [];

    async function loadUsers() {
      var box = document.getElementById('usersList');
      box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
      try {
        var res = await fetch('/api/users');
        var data = await res.json();
        allUsers = data.users || [];
        renderUsers(allUsers);
      } catch (err) {
        box.innerHTML = '<p style="opacity:0.7">Could not load users.</p>';
      }
    }

    function filterUsers() {
      var q = (document.getElementById('searchBox').value || '').toLowerCase().trim();
      var role = document.getElementById('roleFilter').value;
      var filtered = allUsers.filter(function(u) {
        var matchRole = role === 'all' || (u.role || '') === role;
        if (!matchRole) return false;
        if (!q) return true;
        var hay = [
          u.firstname, u.lastname, u.nickname, u.email, u.phone, u.role
        ].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      renderUsers(filtered);
    }

    function renderUsers(users) {
      var box = document.getElementById('usersList');
      if (!users.length) {
        box.innerHTML = '<p style="opacity:0.7">No users found.</p>';
        return;
      }

      var html = '';
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        var id = u.id || '';
        var role = u.role || 'customer';
        var status = u.status || 'active';
        var verified = Number(u.verified) === 1;

        html += '<div class="user-card" data-id="' + id + '">';
        html += '<div class="user-top">';
        html += '<div><div class="user-name">' + (u.firstname || '') + ' ' + (u.lastname || '') + '</div>';
        html += '<div style="font-size:13px;opacity:0.8">@' + (u.nickname || '') + '</div></div>';
        html += '<div>';
        html += '<span class="badge role-' + role + '">' + role + '</span>';
        html += '<span class="badge status-' + status + '">' + status + '</span>';
        html += '<span class="badge ' + (verified ? 'verified' : 'unverified') + '">' + (verified ? 'verified' : 'unverified') + '</span>';
        html += '</div></div>';

        html += '<div class="user-meta">';
        html += 'Email: ' + (u.email || '–') + '<br>';
        html += 'Phone: ' + (u.phone || '–') + '<br>';
        html += 'Joined: ' + (u.created_at || '–');
        html += '</div>';

        html += '<div class="actions">';
        html += '<button type="button" onclick="toggleOrders(\'' + id + '\')">Orders</button>';
        html += '<button type="button" class="secondary" onclick="toggleMessage(\'' + id + '\')">Message</button>';

        if (status === 'active') {
          html += '<button type="button" class="secondary" onclick="setStatus(\'' + id + '\',\'suspended\')">Suspend</button>';
        } else {
          html += '<button type="button" class="success" onclick="setStatus(\'' + id + '\',\'active\')">Reactivate</button>';
        }

        if (role === 'customer') {
          html += '<button type="button" class="secondary" onclick="setRole(\'' + id + '\',\'seller\')">Make Seller</button>';
        } else if (role === 'seller') {
          html += '<button type="button" class="secondary" onclick="setRole(\'' + id + '\',\'customer\')">Make Customer</button>';
        }

        if (role !== 'admin') {
          html += '<button type="button" class="danger" onclick="deleteUser(\'' + id + '\', \'' + (u.nickname || '').replace(/'/g, '') + '\')">Delete</button>';
        }
        html += '</div>';

        // Orders panel
        html += '<div class="orders-box" id="orders-' + id + '"></div>';

        // Message panel
        html += '<div class="msg-box" id="msg-' + id + '">';
        html += '<textarea id="msgText-' + id + '" placeholder="Type message to ' + (u.nickname || 'user') + '..."></textarea>';
        html += '<button type="button" onclick="sendMessage(\'' + id + '\', \'' + (u.nickname || '') + '\')">Send Message</button>';
        html += '</div>';

        html += '</div>';
      }
      box.innerHTML = html;
    }

    function toggleOrders(userId) {
      var el = document.getElementById('orders-' + userId);
      if (!el) return;
      if (el.classList.contains('open')) {
        el.classList.remove('open');
        return;
      }
      // close others optional
      el.classList.add('open');
      el.innerHTML = '<p style="opacity:0.7">Loading orders...</p>';
      loadUserOrders(userId);
    }

    async function loadUserOrders(userId) {
      var el = document.getElementById('orders-' + userId);
      try {
        var res = await fetch('/api/orders?user_id=' + encodeURIComponent(userId));
        var data = await res.json();
        var orders = data.orders || [];
        if (!orders.length) {
          el.innerHTML = '<p style="opacity:0.7">No orders for this user.</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < orders.length; i++) {
          var o = orders[i];
          html += '<div class="order-line">';
          html += '<strong>' + (o.id || '') + '</strong> · ' + (o.status || 'Pending');
          html += '<br>₦' + Number(o.total || 0).toLocaleString();
          html += ' · ' + (o.payment_method || '') + ' · ' + (o.payment_status || 'pending');
          if (o.payment_reference) html += '<br>Ref: ' + o.payment_reference;
          html += '</div>';
        }
        html += '<a href="/admin/orders.html" style="color:var(--gold);font-size:13px">Open Orders panel →</a>';
        el.innerHTML = html;
      } catch (err) {
        el.innerHTML = '<p style="opacity:0.7">Could not load orders.</p>';
      }
    }

    function toggleMessage(userId) {
      var el = document.getElementById('msg-' + userId);
      if (!el) return;
      el.classList.toggle('open');
    }

async function sendMessage(userId, nickname) {
  var textEl = document.getElementById('msgText-' + userId);
  var text = (textEl && textEl.value || '').trim();
  if (!text) { alert('Type a message first'); return; }
  try {
    var res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: adminUser.id,
        sender_role: 'admin',
        sender_name: 'Admin',
        receiver_id: userId,
        receiver_role: 'customer',
        message: text
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    textEl.value = '';
    showToast('Message sent');
  } catch (err) {
    alert(err.message || 'Failed');
  }
    }
  

    async function setStatus(userId, status) {
      try {
        var res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, status: status })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast(status === 'suspended' ? 'User suspended' : 'User reactivated');
        loadUsers();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    async function setRole(userId, role) {
      try {
        var res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, role: role })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast('Role updated to ' + role);
        loadUsers();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    async function deleteUser(userId, nickname) {
      if (!confirm('Delete user @' + nickname + '? This cannot be undone.')) return;
      try {
        var res = await fetch('/api/users?id=' + encodeURIComponent(userId), {
          method: 'DELETE'
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast('User deleted');
        loadUsers();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    loadUsers();