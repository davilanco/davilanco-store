/* Extracted script 1 from dashboard.html */
// ========== AUTH ==========
    const token = localStorage.getItem('token');
    // Send the signed login token to APIs that verify the current account.
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
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent('/dashboard.html');
    }

    let user = {};
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      localStorage.clear();
      window.location.href = '/login.html';
    }

    // ========== THEME (Dark default) ==========
    const savedTheme = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    }

    // ========== NAV ==========
    function toggleNav() {
      document.getElementById('navDrawer').classList.toggle('open');
    }

    if (user.role === 'seller' || user.role === 'admin') {
      document.getElementById('sellerLink').classList.remove('hidden');
    }
    if (user.role === 'admin') {
      document.getElementById('adminLink').classList.remove('hidden');
    }

    document.getElementById('logoutBtn').addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
    });

    window.addEventListener('scroll', function() {
      document.getElementById('backToTop').style.display = window.scrollY > 300 ? 'block' : 'none';
    });

    // ========== USER DETAILS ==========
    document.getElementById('nicknameDisplay').textContent = user.nickname || 'User';
    document.getElementById('fullName').textContent = (user.firstname || '') + ' ' + (user.lastname || '');
    document.getElementById('nick').textContent = user.nickname || '–';
    document.getElementById('phone').textContent = user.phone || '–';
    document.getElementById('email').textContent = user.email || '–';
    document.getElementById('role').textContent = user.role || 'customer';

    function toggleEdit() {
      const form = document.getElementById('editForm');
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) {
        document.getElementById('e_firstname').value = user.firstname || '';
        document.getElementById('e_lastname').value = user.lastname || '';
        document.getElementById('e_phone').value = user.phone || '';
      }
    }

    function saveDetails() {
      user.firstname = document.getElementById('e_firstname').value.trim();
      user.lastname = document.getElementById('e_lastname').value.trim();
      user.phone = document.getElementById('e_phone').value.trim();
      localStorage.setItem('user', JSON.stringify(user));
      document.getElementById('fullName').textContent = user.firstname + ' ' + user.lastname;
      document.getElementById('phone').textContent = user.phone;
      toggleEdit();
      alert('Details updated locally. (Full server save coming next)');
    }

    function changePassword() {
      const msg = document.getElementById('passMsg');
      const n1 = document.getElementById('newPass').value;
      const n2 = document.getElementById('newPass2').value;
      if (!n1 || n1 !== n2) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'New passwords do not match';
        return;
      }
      if (n1.length < 8) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Password must be at least 8 characters';
        return;
      }
      msg.style.color = '#27ae60';
      msg.textContent = 'Password change will be connected to API next.';
    }

    // ========== CART ==========
    function loadCartSummary() {
      const box = document.getElementById('cartCard');
      let cart = [];
      try {
        cart = JSON.parse(localStorage.getItem('cart') || '[]');
      } catch (e) {
        cart = [];
      }

      if (!cart.length) {
        box.innerHTML = '<p>Your cart is empty.</p><a href="/"><button style="margin-top:8px">Continue Shopping</button></a>';
        return;
      }

      let total = 0;
      let html = '';
      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        total += item.price * item.quantity;
        html += '<div class="order-item">' + (item.name || 'Item') + ' × ' + item.quantity + ' — ₦' + (item.price * item.quantity).toLocaleString() + '</div>';
      }
      html += '<p style="margin-top:10px"><strong>Total: ₦' + total.toLocaleString() + '</strong></p>';
      html += '<a href="/cart.html"><button style="margin-top:8px">View Cart / Checkout</button></a>';
      box.innerHTML = html;
    }

    // ========== ORDERS ==========
    async function loadOrders() {
      const list = document.getElementById('ordersList');

      if (!user.id) {
        list.innerHTML = '<p style="opacity:0.7">Login to see your orders.</p>';
        return;
      }

      try {
        const res = await fetch('/api/orders?user_id=' + encodeURIComponent(user.id));
        const data = await res.json();
        const orders = data.orders || [];

        if (!orders.length) {
          list.innerHTML = '<p style="opacity:0.7">No orders yet. <a href="/" style="color:var(--gold)">Shop now</a></p>';
          return;
        }

        let html = '';
        let latestTracked = null;

        for (let i = 0; i < orders.length; i++) {
          const o = orders[i];
          const status = (o.status || 'Pending').toLowerCase();
          let badge = 'pending';
          if (status.indexOf('approved') !== -1) badge = 'approved';
          if (status.indexOf('ship') !== -1 || status.indexOf('transit') !== -1) badge = 'shipping';
          if (status.indexOf('deliver') !== -1) badge = 'delivered';

          let itemsText = '';
          if (o.items && o.items.length) {
            const parts = [];
            for (let j = 0; j < o.items.length; j++) {
              parts.push((o.items[j].product_name || 'Item') + ' × ' + o.items[j].quantity);
            }
            itemsText = parts.join(', ');
          }

          html += '<div class="order-item">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">';
          html += '<strong>' + (o.id || '') + '</strong>';
          html += '<span class="status ' + badge + '">' + (o.status || 'Pending') + '</span>';
          html += '</div>';
          html += '<div style="margin-top:6px;font-size:13px;opacity:0.9">';
          html += 'Total: ₦' + Number(o.total || 0).toLocaleString() + '<br>';
          html += 'Payment: ' + (o.payment_method || '–') + ' · ' + (o.payment_status || 'pending') + '<br>';
          html += 'Reference: <span style="color:var(--gold)">' + (o.payment_reference || o.id) + '</span>';
          if (itemsText) {
            html += '<br>Items: ' + itemsText;
          }
          if (o.tracking_number) {
            html += '<br>Tracking: ' + o.tracking_number;
            if (o.logistics) html += ' (' + o.logistics + ')';
            if (o.eta) html += ' · ETA: ' + o.eta;
            if (!latestTracked) latestTracked = o;
          }
          html += '</div></div>';
        }

        list.innerHTML = html;

        if (latestTracked) {
          document.getElementById('courier').textContent = latestTracked.logistics || '–';
          document.getElementById('trackingNo').textContent = latestTracked.tracking_number || '–';
          document.getElementById('eta').textContent = latestTracked.eta || '–';
        }

      } catch (err) {
        list.innerHTML = '<p style="opacity:0.7">Could not load orders. Please refresh.</p>';
      }
    }

    // ========== MESSAGES (Admin only for now) ==========
    async function loadMessages() {
  var box = document.getElementById('messagesBox');
  if (!user || !user.id) return;
  try {
    var res = await fetch('/api/messages?user_id=' + encodeURIComponent(user.id));
    var data = await res.json();
    var msgs = data.messages || [];
    if (!msgs.length) {
      box.innerHTML = '<p style="opacity:0.7">No messages yet.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      var who = m.sender_role === 'admin' ? 'Admin' : 'You';
      html += '<div style="margin-bottom:6px"><strong>' + who + ':</strong> ' +
        String(m.message || '').replace(/</g, '&lt;') + '</div>';
    }
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<p style="opacity:0.7">Could not load messages.</p>';
  }
}

async function sendMessage() {
  var text = document.getElementById('msgInput').value.trim();
  if (!text || !user || !user.id) return;
  try {
    var res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: user.id,
        sender_role: user.role || 'customer',
        sender_name: user.nickname || 'Customer',
        receiver_id: null,
        receiver_role: 'admin',
        message: text
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    document.getElementById('msgInput').value = '';
    loadMessages();
  } catch (err) {
    alert(err.message || 'Could not send');
  }
}

// call with other loaders:
loadMessages();

    
    
    function applySeller() {
      const products = document.getElementById('s_products').value.trim();
      const address = document.getElementById('s_address').value.trim();
      const idnum = document.getElementById('s_idnumber').value.trim();
      const msg = document.getElementById('sellerMsg');

      if (!products || !address || !idnum) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Please fill all required fields';
        return;
      }

      msg.style.color = '#27ae60';
      msg.textContent = 'Application submitted (API connection coming next).';
    }

    // Start
    loadCartSummary();
    loadOrders();