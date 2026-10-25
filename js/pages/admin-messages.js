/* Extracted script 1 from admin/messages.html */
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
      window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/messages.html');
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
      t.textContent = text || 'Sent';
      t.style.display = 'block';
      setTimeout(function() { t.style.display = 'none'; }, 1500);
    }

    var allUsers = [];
    var selectedUser = null;

    async function loadUsers() {
      try {
        var res = await fetch('/api/users');
        var data = await res.json();
        allUsers = data.users || [];
        renderUserList(allUsers);
      } catch (e) {
        document.getElementById('usersSide').innerHTML = '<p style="opacity:0.7">Could not load users</p>';
      }
    }

    function filterUserList() {
      var q = (document.getElementById('userSearch').value || '').toLowerCase();
      var filtered = allUsers.filter(function(u) {
        if (!q) return true;
        return [u.nickname, u.email, u.firstname, u.lastname, u.phone, u.role]
          .join(' ').toLowerCase().indexOf(q) !== -1;
      });
      renderUserList(filtered);
    }

    function renderUserList(users) {
      var box = document.getElementById('usersSide');
      if (!users.length) {
        box.innerHTML = '<p style="opacity:0.7;font-size:13px">No users</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        var active = selectedUser && selectedUser.id === u.id ? ' active' : '';
        html += '<div class="user-item' + active + '" onclick=\'selectUser(' + JSON.stringify(u).replace(/'/g, "&#39;") + ')\'>';
        html += '<strong>@' + (u.nickname || '') + '</strong> · ' + (u.role || '');
        html += '<small>' + (u.firstname || '') + ' ' + (u.lastname || '') + ' · ' + (u.email || '') + '</small>';
        html += '</div>';
      }
      box.innerHTML = html;
    }

    function selectUser(u) {
      selectedUser = u;
      document.getElementById('threadTitle').textContent = 'Chat with @' + (u.nickname || 'user');
      renderUserList(allUsers);
      loadThread();
    }

    async function loadThread() {
      var box = document.getElementById('threadBox');
      if (!selectedUser) {
        box.innerHTML = '<p style="opacity:0.7">Select a user first.</p>';
        return;
      }
      box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
      try {
        var res = await fetch('/api/messages?user_id=' + encodeURIComponent(selectedUser.id));
        var data = await res.json();
        var msgs = data.messages || [];
        if (!msgs.length) {
          box.innerHTML = '<p style="opacity:0.7">No messages yet. Send the first one.</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < msgs.length; i++) {
          var m = msgs[i];
          var isMe = (m.sender_role === 'admin');
          html += '<div class="bubble ' + (isMe ? 'me' : 'them') + '">';
          html += '<div class="meta">' + (m.sender_name || m.sender_role || '') + ' · ' + (m.created_at || '') + '</div>';
          html += escapeHtml(m.message || '');
          html += '</div>';
        }
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
      } catch (e) {
        box.innerHTML = '<p style="opacity:0.7">Could not load messages.</p>';
      }
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    async function sendAdminReply() {
      if (!selectedUser) {
        alert('Select a user first');
        return;
      }
      var text = document.getElementById('msgInput').value.trim();
      if (!text) return;

      try {
        var res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: adminUser.id,
            sender_role: 'admin',
            sender_name: 'Admin',
            receiver_id: selectedUser.id,
            receiver_role: selectedUser.role || 'customer',
            message: text
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        document.getElementById('msgInput').value = '';
        showToast('Sent');
        loadThread();
        loadAllMessages();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    async function loadAllMessages() {
      var box = document.getElementById('allFeed');
      try {
        var res = await fetch('/api/messages?all=1');
        var data = await res.json();
        var msgs = data.messages || [];
        if (!msgs.length) {
          box.innerHTML = '<p style="opacity:0.7">No messages yet.</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < Math.min(msgs.length, 40); i++) {
          var m = msgs[i];
          html += '<div style="padding:8px 0;border-bottom:1px solid var(--border)">';
          html += '<strong>' + escapeHtml(m.sender_name || m.sender_role || '') + '</strong>';
          html += ' → ' + escapeHtml(m.receiver_role || '');
          html += '<br>' + escapeHtml(m.message || '');
          html += '<br><span style="opacity:0.6">' + (m.created_at || '') + '</span>';
          html += '</div>';
        }
        box.innerHTML = html;
      } catch (e) {
        box.innerHTML = '<p style="opacity:0.7">Could not load feed.</p>';
      }
    }

    window.selectUser = selectUser;
    loadUsers();
    loadAllMessages();