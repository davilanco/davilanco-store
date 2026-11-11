/* Davilanco Seller — isolated page bundle. */
(function () {
  'use strict';
  var html = document.documentElement;
  var path = window.location.pathname;
  html.classList.add('dvl-seller-auth-pending');
  window.toggleNav = function () {
    var drawer = document.getElementById('navDrawer');
    if (drawer) drawer.classList.toggle('open');
  };
  window.toggleTheme = function () {
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (_) {}
  };
  document.addEventListener('click', async function (event) {
    var link = event.target.closest && event.target.closest('#logoutBtn');
    if (!link) return;
    event.preventDefault();
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }); } catch (_) {}
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
    window.location.replace('/login.html');
  }, true);
  fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } })
    .then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) {
      if (!response.ok || !data.ok || !data.user || !data.user.id) throw new Error('LOGIN_REQUIRED');
      if (data.user.role !== 'seller' && data.user.role !== 'admin') throw new Error('SELLER_REQUIRED');
      window.dvlSellerUser = data.user;
      try { localStorage.setItem('user', JSON.stringify(data.user)); } catch (_) {}
      return data.user;
    }); })
    .then(function (user) {
      html.setAttribute('data-theme', (function () { try { return localStorage.getItem('theme') || 'dark'; } catch (_) { return 'dark'; } })());
      var adminLink = document.getElementById('adminLink');
      if (adminLink) adminLink.hidden = user.role !== 'admin';
      var dashboardLink = document.querySelector('a[href="/dashboard.html"]');
      if (dashboardLink) dashboardLink.hidden = false;
      html.classList.remove('dvl-seller-auth-pending');
      runSellerPage();
    })
    .catch(function (error) {
      if (error && error.message === 'SELLER_REQUIRED') {
        window.location.replace('/dashboard.html');
        return;
      }
      window.location.replace('/login.html?redirect=' + encodeURIComponent(path));
    });
  function runSellerPage() {
/* ===== js/pages/seller-index.js ===== */
if (["/seller/","/seller/index.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from seller/index.html */
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

    var user = window.dvlSellerUser;
    if (!user || (user.role !== 'seller' && user.role !== 'admin')) {
      window.location.replace('/dashboard.html');
      return;
    }
    if (user.role === 'admin') {
      var adminLink = document.getElementById('adminLink');
      if (adminLink) adminLink.style.display = 'block';
    }
    document.getElementById('sellerName').textContent = user.nickname || 'Seller';

    function showToast(t) {
      var el = document.getElementById('toast');
      el.textContent = t || 'Saved';
      el.style.display = 'block';
      setTimeout(function() { el.style.display = 'none'; }, 1600);
    }

    // ========== R2 IMAGE UPLOAD ==========
    var uploadedUrl = '';

    async function onFileSelected(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type || file.type.indexOf('image/') !== 0) {
        alert('Please choose an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('Max file size is 5MB');
        return;
      }

      var prev = document.getElementById('imgPreview');
      prev.src = URL.createObjectURL(file);
      prev.style.display = 'block';

      var msg = document.getElementById('addMsg');
      msg.style.color = 'var(--text)';
      msg.textContent = 'Uploading image...';

      try {
        var form = new FormData();
        form.append('file', file);

        var res = await fetch('/api/upload', {
          method: 'POST',
          body: form
        });

        var data = await res.json();
        if (!data.ok || !data.url) {
          throw new Error(data.error || 'Upload failed');
        }

        uploadedUrl = data.url;
        document.getElementById('p_image_url').value = data.url;
        msg.style.color = '#27ae60';
        msg.textContent = 'Image uploaded';
      } catch (err) {
        uploadedUrl = '';
        msg.style.color = '#e74c3c';
        msg.textContent = err.message || 'Upload failed';
      }
    }

    function getImageValue() {
      return document.getElementById('p_image_url').value.trim() || uploadedUrl || '';
    }

    // ========== ADD PRODUCT ==========
    async function addProduct() {
      var msg = document.getElementById('addMsg');
      var name = document.getElementById('p_name').value.trim();
      var price = Number(document.getElementById('p_price').value);
      var stock = Number(document.getElementById('p_stock').value);
      var image = getImageValue();

      if (!name || !price) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Name and price are required';
        return;
      }

      try {
        var res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            price: price,
            stock: stock || 0,
            category: document.getElementById('p_category').value.trim() || 'others',
            description: document.getElementById('p_desc').value.trim(),
            image: image,
            status: 'pending',
            seller_id: user.id
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');

        msg.style.color = '#27ae60';
        msg.textContent = 'Submitted! Waiting for admin approval.';
        showToast('Product submitted');

        document.getElementById('p_name').value = '';
        document.getElementById('p_price').value = '';
        document.getElementById('p_desc').value = '';
        document.getElementById('p_image_url').value = '';
        document.getElementById('p_image_file').value = '';
        uploadedUrl = '';
        document.getElementById('imgPreview').style.display = 'none';

        loadMyProducts();
      } catch (err) {
        msg.style.color = '#e74c3c';
        msg.textContent = err.message || 'Failed to add product';
      }
    }

    // ========== MY PRODUCTS ==========
    function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}
function safeSellerImage(value) {
  var url = String(value || '');
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '';
}

async function loadMyProducts() {
      var box = document.getElementById('myProducts');
      box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
      try {
        var res = await fetch('/api/products?all=1');
        var data = await res.json();
        var products = Array.isArray(data) ? data : [];
        var mine = products.filter(function(p) {
          return p.seller_id === user.id;
        });

        if (!mine.length) {
          box.innerHTML = '<p style="opacity:0.7">No products yet. Add one above.</p>';
          return;
        }

        var html = '';
        for (var i = 0; i < mine.length; i++) {
          var p = mine[i];
          var st = p.status || 'pending';
          html += '<div class="product-row">';
          if (p.image && (p.image.indexOf('http') === 0 || p.image.indexOf('data:') === 0)) {
            html += '<img src="' + safeSellerImage(p.image) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;float:left;margin-right:10px">';
          }
          html += '<strong>' + escapeHtml(p.name || '') + '</strong> ';
          html += '<span class="badge ' + (['approved','pending','rejected'].includes(st) ? st : 'pending') + '">' + escapeHtml(st) + '</span><br>';
          html += '₦' + Number(p.price || 0).toLocaleString() + ' · Stock: ' + (p.stock != null ? p.stock : 0);
          html += '<br>' + escapeHtml(p.category || '');
          html += '<div style="clear:both"></div></div>';
        }
        box.innerHTML = html;
      } catch (e) {
        box.innerHTML = '<p style="opacity:0.7">Could not load products.</p>';
      }
    }

    // ========== ORDERS ==========
    async function loadMyOrders() {
      var box = document.getElementById('myOrders');
      box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
      try {
        var prodRes = await fetch('/api/products?all=1');
        var prodData = await prodRes.json();
        var products = Array.isArray(prodData) ? prodData : [];
        var myIds = {};
        for (var i = 0; i < products.length; i++) {
          if (products[i].seller_id === user.id) {
            myIds[products[i].id] = products[i].name;
          }
        }

        var ordRes = await fetch('/api/orders?all=1');
        var ordData = await ordRes.json();
        var orders = ordData.orders || [];

        var html = '';
        var found = 0;

        for (var o = 0; o < orders.length; o++) {
          var order = orders[o];
          var items = order.items || [];
          var myItems = [];
          for (var j = 0; j < items.length; j++) {
            if (myIds[items[j].product_id]) {
              myItems.push(items[j]);
            }
          }
          if (!myItems.length) continue;
          found++;

          html += '<div class="order-row">';
          html += '<strong>' + escapeHtml(order.id || '') + '</strong> · ' + escapeHtml(order.status || 'Pending') + '<br>';
          html += 'Customer: ' + escapeHtml(order.firstname || '') + ' ' + escapeHtml(order.lastname || '') + '<br>';
          html += 'Phone: ' + escapeHtml(order.phone || '') + '<br>';
          html += 'Address: ' + escapeHtml(order.address || '') + ', ' + escapeHtml(order.town || '') + ', ' + escapeHtml(order.state || '') + '<br>';
          html += 'Items: ';
          for (var k = 0; k < myItems.length; k++) {
            html += escapeHtml(myItems[k].product_name || '') + ' x' + escapeHtml(myItems[k].quantity) + (k < myItems.length - 1 ? ', ' : '');
          }
          html += '<br>Pay: ' + (order.payment_status || 'pending');
          if (order.tracking_number) {
            html += '<br>Tracking: ' + escapeHtml(order.tracking_number);
          }
          html += '<div style="margin-top:8px">';
          html += '<input type="text" id="tr_' + escapeHtml(order.id) + '" placeholder="Tracking number" value="' + escapeHtml(order.tracking_number || '') + '">';
          html += '<input type="text" id="lg_' + escapeHtml(order.id) + '" placeholder="Logistics" value="' + escapeHtml(order.logistics || '') + '">';
          html += '<input type="text" id="eta_' + escapeHtml(order.id) + '" placeholder="ETA" value="' + escapeHtml(order.eta || '') + '">';
          html += '<button type="button" onclick="saveTracking(\'' + order.id + '\')">Save Tracking</button>';
          html += '</div></div>';
        }

        if (!found) {
          box.innerHTML = '<p style="opacity:0.7">No orders for your products yet.</p>';
        } else {
          box.innerHTML = html;
        }
      } catch (e) {
        box.innerHTML = '<p style="opacity:0.7">Could not load orders.</p>';
      }
    }

    async function saveTracking(orderId) {
      try {
        var res = await fetch('/api/orders-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            status: 'Shipping',
            tracking_number: document.getElementById('tr_' + orderId).value.trim(),
            logistics: document.getElementById('lg_' + orderId).value.trim(),
            eta: document.getElementById('eta_' + orderId).value.trim()
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast('Tracking saved');
        loadMyOrders();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    async function messageAdmin() {
      var text = document.getElementById('adminMsg').value.trim();
      var status = document.getElementById('msgStatus');
      if (!text) return;
      try {
        var res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: user.id,
            sender_role: 'seller',
            sender_name: user.nickname || 'Seller',
            receiver_id: null,
            receiver_role: 'admin',
            message: text
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        document.getElementById('adminMsg').value = '';
        status.style.color = '#27ae60';
        status.textContent = 'Message sent to admin';
      } catch (err) {
        status.style.color = '#e74c3c';
        status.textContent = err.message || 'Failed';
      }
    }

    loadMyProducts();
    loadMyOrders();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof onFileSelected === "function") window.onFileSelected = onFileSelected;
  if (typeof addProduct === "function") window.addProduct = addProduct;
  if (typeof loadMyProducts === "function") window.loadMyProducts = loadMyProducts;
  if (typeof loadMyOrders === "function") window.loadMyOrders = loadMyOrders;
  if (typeof messageAdmin === "function") window.messageAdmin = messageAdmin;
  })();
}


  }
})();
