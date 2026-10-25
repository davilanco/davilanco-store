/* Extracted script 1 from admin/orders.html */
async function placeOnAe(orderId) {
  var order = (window.adminOrders || []).find(function(item) { return item.id === orderId; });
  var itemSummary = order && Array.isArray(order.items)
    ? order.items.map(function(item) { return (item.product_name || 'Item') + ' x' + item.quantity; }).join(', ')
    : 'Review items in the order card';
  var destination = order
    ? [order.firstname, order.lastname, order.address, order.town, order.lga, order.state, order.phone].filter(Boolean).join(', ')
    : 'Review delivery details in the order card';
  if (!confirm('MANUAL REVIEW — this will submit a real supplier purchase.\n\nOrder: ' + orderId
    + '\nItems: ' + itemSummary + '\nDeliver to: ' + destination
    + '\n\nConfirm customer payment, product variant and delivery address before continuing.')) return;
  try {
    var res = await fetch('/api/ae-place-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    });
    var data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Supplier order failed');
    alert('AliExpress order reference: ' + (data.ae_order_id || 'already submitted'));
    loadOrders();
  } catch (err) { alert(err.message || 'Could not place supplier order'); }
}
async function pullTracking(orderId) {
  try {
    var res = await fetch('/api/ae-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    });
    var data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Tracking refresh failed');
    alert(data.tracking
      ? ('Tracking: ' + data.tracking.number + (data.tracking.carrier ? ' (' + data.tracking.carrier + ')' : ''))
      : (data.message || 'No tracking number yet'));
    loadOrders();
  } catch (err) { alert(err.message || 'Could not refresh tracking'); }
}
function selectOrderByIndex(index) { if (window.adminOrders && window.adminOrders[index]) selectOrder(window.adminOrders[index]); }
function quickConfirmByIndex(index) { if (window.adminOrders && window.adminOrders[index]) quickConfirm(window.adminOrders[index].id); }
function placeOnAeByIndex(index) { if (window.adminOrders && window.adminOrders[index]) placeOnAe(window.adminOrders[index].id); }
function pullTrackingByIndex(index) { if (window.adminOrders && window.adminOrders[index]) pullTracking(window.adminOrders[index].id); }
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}
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
      window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/orders.html');
    }
    var user = {};
    try { user = JSON.parse(userStr); } catch (e) {
      localStorage.clear();
      window.location.href = '/login.html';
    }
    if (user.role !== 'admin') {
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
      t.textContent = text || 'Saved';
      t.style.display = 'block';
      setTimeout(function() { t.style.display = 'none'; }, 1800);
    }

    function badgeClass(status) {
      var s = (status || '').toLowerCase();
      if (s.indexOf('approved') !== -1) return 'approved';
      if (s.indexOf('ship') !== -1 || s.indexOf('transit') !== -1) return 'shipping';
      if (s.indexOf('deliver') !== -1) return 'delivered';
      return 'pending';
    }

    function selectOrder(order) {
      document.getElementById('u_orderId').value = order.id || '';
      document.getElementById('u_status').value = order.status || 'Pending';
      document.getElementById('u_payment').value = order.payment_status || 'pending';
      document.getElementById('u_tracking').value = order.tracking_number || '';
      document.getElementById('u_logistics').value = order.logistics || '';
      document.getElementById('u_eta').value = order.eta || '';
      document.getElementById('updateMsg').textContent = 'Selected: ' + order.id;
      document.getElementById('tracking').scrollIntoView({ behavior: 'smooth' });
    }

    async function loadOrders() {
      var box = document.getElementById('ordersBox');
      box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
      try {
        var res = await fetch('/api/orders?all=1');
        var data = await res.json();
        var orders = data.orders || [];
        window.adminOrders = orders;
        if (!orders.length) {
          box.innerHTML = '<p style="opacity:0.7">No orders yet.</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < orders.length; i++) {
          var o = orders[i];
          var itemsText = '';
          if (o.items && o.items.length) {
            var parts = [];
            for (var j = 0; j < o.items.length; j++) {
              parts.push(escapeHtml(o.items[j].product_name || 'Item') + ' x' + escapeHtml(o.items[j].quantity));
            }
            itemsText = parts.join(', ');
          }
          html += '<div class="order-card">';
          html += '<div class="order-top">';
          html += '<strong>' + escapeHtml(o.id || '') + '</strong>';
          html += '<span class="status ' + badgeClass(o.status) + '">' + escapeHtml(o.status || 'Pending') + '</span>';
          html += '</div><div class="meta">';
          html += escapeHtml(o.firstname || '') + ' ' + escapeHtml(o.lastname || '') + ' · ' + escapeHtml(o.phone || '') + '<br>';
          html += escapeHtml(o.address || '') + ', ' + escapeHtml(o.town || '') + ', ' + escapeHtml(o.state || '') + '<br>';
          html += 'Total: ₦' + Number(o.total || 0).toLocaleString() + '<br>';
          html += 'Pay: ' + escapeHtml(o.payment_method || '–') + ' · ' + escapeHtml(o.payment_status || 'pending') + '<br>';
          html += 'Ref: ' + escapeHtml(o.payment_reference || o.id);
          if (itemsText) html += '<br>Items: ' + itemsText;
          if (o.tracking_number) {
            html += '<br>Track: ' + escapeHtml(o.tracking_number);
            if (o.logistics) html += ' (' + escapeHtml(o.logistics) + ')';
            if (o.eta) html += ' · ETA ' + escapeHtml(o.eta);
          }
          if (o.ae_order_id) html += '<br>AliExpress order: ' + escapeHtml(o.ae_order_id);
          if (o.ae_status === 'uncertain') html += '<br><strong>Supplier order needs a manual AliExpress history check before retrying.</strong>';
          else if (o.ae_status === 'submitting') html += '<br>Supplier submission in progress; do not submit again yet.';
          html += '</div>';
          html += '<button type="button" onclick="selectOrderByIndex(' + i + ')">Select</button>';
          if ((o.payment_method || '') === 'bank_transfer' && (o.payment_status || '') !== 'paid') {
            html += '<button type="button" class="success" onclick="quickConfirmByIndex(' + i + ')">Confirm Bank Transfer</button>';
          }
          if ((o.payment_status || '').toLowerCase() === 'paid' && !o.ae_order_id && o.ae_status !== 'submitting' && o.ae_status !== 'uncertain') {
            html += '<button type="button" onclick="placeOnAeByIndex(' + i + ')">Place on AliExpress</button>';
          }
          if (o.ae_order_id) html += '<button type="button" class="secondary" onclick="pullTrackingByIndex(' + i + ')">Pull tracking</button>';
          html += '</div>';
        }
        box.innerHTML = html;
      } catch (err) {
        box.innerHTML = '<p style="opacity:0.7">Could not load orders.</p>';
      }
    }

    async function updateOrder() {
      var msg = document.getElementById('updateMsg');
      var orderId = document.getElementById('u_orderId').value.trim();
      if (!orderId) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Select an order first';
        return;
      }
      try {
        var res = await fetch('/api/orders-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            status: document.getElementById('u_status').value,
            payment_status: document.getElementById('u_payment').value,
            tracking_number: document.getElementById('u_tracking').value.trim(),
            logistics: document.getElementById('u_logistics').value.trim(),
            eta: document.getElementById('u_eta').value.trim()
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Update failed');
        msg.style.color = '#27ae60';
        msg.textContent = 'Order updated';
        showToast('Order updated');
        loadOrders();
      } catch (err) {
        msg.style.color = '#e74c3c';
        msg.textContent = err.message || 'Update failed';
      }
    }

    async function markPaidAndApprove() {
      document.getElementById('u_status').value = 'Approved';
      document.getElementById('u_payment').value = 'paid';
      await updateOrder();
    }

    async function quickConfirm(orderId) {
      try {
        var res = await fetch('/api/orders-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            status: 'Approved',
            payment_status: 'paid'
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast('Bank transfer confirmed');
        loadOrders();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    window.selectOrder = selectOrder;
    window.quickConfirm = quickConfirm;
    loadOrders();