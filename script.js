/* ============================================================
   Davilanco storefront bundle — complete and correct.
   Loaded by: index, cart, categories, category, product, checkout,
   payment-success, seller-profile, login, signup, verify, oauth,
   dashboard.
   Admin and seller pages load /admin/admin.js and /seller/seller.js
   respectively, so their page blocks are not included here.
   ============================================================ */

/* ===== Shared authenticated API transport and admin route guard ===== */
(function () {
  var path = window.location.pathname;
  var isAdminPage = path === '/admin' || path === '/admin/' || path.indexOf('/admin/') === 0;
  var nativeFetch = window.fetch.bind(window);
  var adminSessionPromise = null;

  function goToLogin(destination) {
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
    window.location.replace('/login.html?redirect=' + encodeURIComponent(destination));
  }

  if (isAdminPage) {
    document.documentElement.classList.add('davilanco-admin-page');
    document.documentElement.classList.add('davilanco-auth-pending');
    var style = document.createElement('style');
    style.textContent = '.davilanco-auth-pending body > main{visibility:hidden}.davilanco-auth-pending body:after{content:"Checking your secure session…";display:block;text-align:center;padding:48px 16px;font:16px sans-serif}';
    document.head.appendChild(style);

    adminSessionPromise = nativeFetch('/api/session', {
      credentials: 'same-origin', cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || !data.ok || !data.user || !data.user.id) {
          goToLogin(path + window.location.search);
          throw new Error(data.error || 'Please sign in to continue.');
        }
        if (data.user.role !== 'admin') {
          window.location.replace('/dashboard.html');
          throw new Error('Administrator access required.');
        }
        try { localStorage.setItem('user', JSON.stringify(data.user)); } catch (_) {}
        document.documentElement.classList.remove('davilanco-auth-pending');
        return data.user;
      });
    }).catch(function (error) {
      if (!document.documentElement.classList.contains('davilanco-auth-pending')) throw error;
      if (error && error.message && !/Failed to fetch/i.test(error.message)) throw error;
      document.documentElement.classList.remove('davilanco-auth-pending');
      var main = document.querySelector('body > main');
      if (main) main.innerHTML = '<p role="alert">Could not verify your administrator session. Check your connection and refresh this page.</p>';
      throw error;
    });
  }

  window.fetch = function (input, init) {
    var requestUrl = typeof input === 'string' ? input : (input && input.url) || '';
    var parsed;
    try { parsed = new URL(requestUrl, window.location.href); } catch (_) {}
    var isApi = parsed && parsed.origin === window.location.origin && parsed.pathname.indexOf('/api/') === 0;
    if (!isApi) return nativeFetch(input, init);

    init = Object.assign({}, init || {});
    var headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    init.headers = headers;
    init.credentials = init.credentials || 'same-origin';
    if (!init.cache) init.cache = 'no-store';

    var perform = function () {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 25000);
      if (init.signal) {
        if (init.signal.aborted) controller.abort();
        else init.signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
      }
      init.signal = controller.signal;
      return nativeFetch(input, init).finally(function () { clearTimeout(timer); });
    };

    if (isAdminPage &&
        parsed.pathname !== '/api/session' &&
        parsed.pathname !== '/api/login' &&
        parsed.pathname !== '/api/logout') {
      return (adminSessionPromise || Promise.resolve()).then(perform);
    }
    return perform();
  };
})();

/* ===== Global helpers ===== */
function davilancoEsc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
  });
}
window.davilancoEsc = davilancoEsc;

(function () {
  var saved = 'dark';
  try { saved = localStorage.getItem('theme') || 'dark'; } catch (_) {}
  document.documentElement.setAttribute('data-theme', saved);
})();

window.toggleTheme = function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch (_) {}
};

window.addEventListener('scroll', function () {
  var btt = document.getElementById('backToTop');
  if (btt) btt.style.display = window.scrollY > 300 ? 'block' : 'none';
});

/* ===== Shared navigation / login form handler ===== */
(function () {
  function getDrawer() { return document.getElementById('navDrawer'); }

  function setExpanded(open) {
    document.querySelectorAll('[onclick*="toggleNav"], [aria-controls="navDrawer"]').forEach(function (button) {
      button.setAttribute('aria-expanded', String(open));
      button.classList.toggle('active', open);
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  var sharedToggleNav = function toggleNav() {
    var drawer = getDrawer();
    if (!drawer) return;
    var open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    setExpanded(open);
  };
  window.toggleNav = sharedToggleNav;

  function updateAccountNavigation() {
    var dashboardLinks = document.querySelectorAll('a[href="/dashboard.html"]');
    var sellerLinks = document.querySelectorAll('a[href="/seller/"]');
    var adminLinks = document.querySelectorAll('a[href="/admin/"], a[href="/admin"]');
    dashboardLinks.forEach(function (link) { link.hidden = true; link.classList.add('hidden'); });
    sellerLinks.forEach(function (link) { link.hidden = true; link.classList.add('hidden'); });
    adminLinks.forEach(function (link) { link.hidden = true; link.classList.add('hidden'); });
    fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.user || !data.user.id) return;
        dashboardLinks.forEach(function (link) { link.hidden = false; link.classList.remove('hidden'); });
        if (data.user.role === 'seller' || data.user.role === 'admin')
          sellerLinks.forEach(function (link) { link.hidden = false; link.classList.remove('hidden'); });
        if (data.user.role === 'admin')
          adminLinks.forEach(function (link) { link.hidden = false; link.classList.remove('hidden'); });
      }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateAccountNavigation);
  else updateAccountNavigation();

  document.addEventListener('click', async function (event) {
    var logout = event.target.closest && event.target.closest('#logoutBtn');
    if (!logout) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
    window.location.replace('/login.html');
  }, true);

  window.togglePasswordVisibility = function (fieldId) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    field.type = field.type === 'password' ? 'text' : 'password';
  };

  /* Authoritative login form handler. Runs in capture phase so it wins before
     any page-level handler and calls stopImmediatePropagation. */
  document.addEventListener('submit', async function (event) {
    var form = event.target;
    if (!form || form.id !== 'loginForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();

    var msg = document.getElementById('msg');
    var button = document.getElementById('submitBtn');
    var login = document.getElementById('login');
    var password = document.getElementById('password');
    if (!msg || !button || !login || !password) return;

    button.disabled = true;
    button.textContent = 'Logging in...';
    msg.className = '';
    msg.textContent = 'Connecting to the login service...';

    try {
      var response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ login: login.value.trim(), password: password.value })
      });
      var raw = await response.text();
      var data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch (_) { throw new Error('The login service returned an unexpected response (HTTP ' + response.status + ').'); }

      if (!response.ok || !data.ok) {
        msg.className = 'error';
        msg.textContent = (data.error || 'Login failed.') + ' (HTTP ' + response.status + ')';
        if (data.needs_verification && data.email) {
          var link = document.createElement('a');
          link.href = '/verify.html?email=' + encodeURIComponent(data.email);
          link.textContent = 'Verify your email';
          msg.append(document.createElement('br'), link);
        }
        return;
      }

      if (!data.token || !data.user || !data.user.id) {
        throw new Error('The login service did not return the expected session details.');
      }
      try {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } catch (_) {}

      var params = new URLSearchParams(window.location.search);
      var requested = params.get('redirect') || '';
      var destination = data.user.role === 'admin' ? '/admin/' :
        (data.user.role === 'seller' ? '/seller/' : '/dashboard.html');
      try {
        var target = new URL(requested, window.location.origin);
        if (requested.charAt(0) === '/' && requested.charAt(1) !== '/' &&
            requested.indexOf(String.fromCharCode(92)) === -1 &&
            target.origin === window.location.origin) {
          destination = target.pathname + target.search + target.hash;
        }
      } catch (_) {}

      msg.className = 'success';
      msg.textContent = 'Login successful! Redirecting...';
      window.setTimeout(function () { window.location.assign(destination); }, 500);
    } catch (error) {
      console.error('[Davilanco login]', error);
      msg.className = 'error';
      msg.textContent = error.message || 'Could not connect to the login service. Please try again.';
    } finally {
      button.disabled = false;
      if (button.textContent === 'Logging in...') button.textContent = 'Login';
    }
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      var drawer = getDrawer();
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        setExpanded(false);
      }
    }
  });
})();

/* ===== Analytics ===== */
(function () {
  'use strict';
  var measurementId = 'G-PVEHSCE72P';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: true });
  var gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  document.head.appendChild(gaScript);

  try {
    var visitorId = localStorage.getItem('davilanco_analytics_visitor');
    if (!visitorId) {
      visitorId = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('davilanco_analytics_visitor', visitorId);
    }

    var path = window.location.pathname || '/';
    var productId = '';
    if (/product\.html$/i.test(path)) {
      productId = new URLSearchParams(window.location.search).get('id') || '';
    }
    var eventType = productId ? 'product_view' : 'page_view';

    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({
        event_type: eventType,
        visitor_id: visitorId,
        path: path.slice(0, 300),
        page_title: (document.title || '').slice(0, 200),
        product_id: productId.slice(0, 100)
      })
    }).catch(function () {});

    if (productId && typeof window.gtag === 'function') {
      gtag('event', 'view_item', { item_id: productId, page_location: window.location.href });
    }
  } catch (e) { /* ignore */ }
})();

/* ===== Home / index ===== */
if (["/", "/index.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;

    function getCart() {
      try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (_) { return []; }
    }
    function saveCart(cart) {
      try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (_) {}
      updateCartCount();
    }
    function updateCartCount() {
      var el = document.getElementById('cartCount');
      if (!el) return;
      var cart = getCart();
      var total = 0;
      cart.forEach(function (item) { total += Number(item.quantity) || 0; });
      el.textContent = total;
    }
    function addToCart(id, name, price, image) {
      var cart = getCart();
      var existing = cart.find(function (item) { return String(item.id) === String(id); });
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + 1;
      } else {
        cart.push({ id: id, name: name, price: price, image: image, quantity: 1 });
      }
      saveCart(cart);
      var toast = document.getElementById('toast');
      if (toast) {
        toast.style.display = 'block';
        setTimeout(function () { toast.style.display = 'none'; }, 1800);
      }
    }

    var allProducts = [];

    async function loadProducts() {
      var grid = document.getElementById('productsGrid');
      var countEl = document.getElementById('productCount');
      if (!grid) return;
      try {
        var res = await fetch('/api/products');
        var data = await res.json();
        allProducts = Array.isArray(data) ? data : (data.results || []);

        var urlParams = new URLSearchParams(window.location.search);
        var catFromUrl = urlParams.get('cat');
        var qFromUrl = urlParams.get('q');

        if (catFromUrl && catFromUrl !== 'all') {
          document.querySelectorAll('.cat-chip').forEach(function (chip) {
            chip.classList.remove('active');
            if (chip.getAttribute('data-cat') === catFromUrl) chip.classList.add('active');
          });
          var filtered = allProducts.filter(function (p) {
            return String(p.category || '').toLowerCase() === String(catFromUrl).toLowerCase();
          });
          renderProducts(filtered);
          if (countEl) countEl.textContent = filtered.length + ' product' + (filtered.length !== 1 ? 's' : '');
        } else if (qFromUrl) {
          filterProducts(qFromUrl);
          var search = document.getElementById('searchBar');
          if (search) search.value = qFromUrl;
        } else {
          renderProducts(allProducts);
          if (countEl) countEl.textContent = allProducts.length + ' product' + (allProducts.length !== 1 ? 's' : '');
        }

        if (allProducts.length === 0) {
          grid.innerHTML = '<div class="state-box"><h3>No products yet</h3><p>Check back soon.</p></div>';
        }
      } catch (err) {
        grid.innerHTML = '<div class="state-box"><h3>Could not load products</h3><p>Please refresh the page.</p></div>';
        if (countEl) countEl.textContent = 'Error';
      }
    }

    function renderProducts(products) {
      var grid = document.getElementById('productsGrid');
      if (!grid) return;
      if (!products || products.length === 0) {
        grid.innerHTML = '<div class="state-box"><h3>No products found</h3><p>Try a different category or search.</p></div>';
        return;
      }
      var html = '';
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var id = p.id || '';
        var name = p.name || 'Unnamed Product';
        var price = Number(p.price || 0);
        var oldPrice = Number(p.old_price || 0);
        var image = p.image || 'https://via.placeholder.com/300x300?text=No+Image';

        html += '<div class="product-card">';
        html +=   '<a href="/product.html?id=' + encodeURIComponent(id) + '" class="product-img-link">';
        html +=     '<img class="product-img" src="' + esc(image) + '" alt="' + esc(name) + '" onerror="this.src=\'https://via.placeholder.com/300x300?text=No+Image\'">';
        html +=   '</a>';
        html +=   '<div class="product-info">';
        html +=     '<a href="/product.html?id=' + encodeURIComponent(id) + '" class="product-name">' + esc(name) + '</a>';
        html +=     '<div class="product-price">₦' + price.toLocaleString();
        if (oldPrice > 0) html += ' <small><s>₦' + oldPrice.toLocaleString() + '</s></small>';
        html +=     '</div>';
        html +=     '<button type="button" class="add-btn" data-id="' + esc(id) + '" data-name="' + esc(name) + '" data-price="' + price + '" data-image="' + esc(image) + '">Add to Cart</button>';
        html +=   '</div>';
        html += '</div>';
      }
      grid.innerHTML = html;
    }

    function filterProducts(query) {
      var q = String(query || '').toLowerCase().trim();
      if (!q) { renderProducts(allProducts); return; }
      var filtered = allProducts.filter(function (p) {
        return String(p.name || '').toLowerCase().indexOf(q) !== -1 ||
               String(p.category || '').toLowerCase().indexOf(q) !== -1;
      });
      renderProducts(filtered);
      var countEl = document.getElementById('productCount');
      if (countEl) countEl.textContent = filtered.length + ' product' + (filtered.length !== 1 ? 's' : '');
    }

    var grid = document.getElementById('productsGrid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.add-btn');
        if (!btn) return;
        addToCart(
          btn.getAttribute('data-id'),
          btn.getAttribute('data-name'),
          Number(btn.getAttribute('data-price')) || 0,
          btn.getAttribute('data-image') || ''
        );
      });
    }

    var categoriesBar = document.getElementById('categoriesBar');
    if (categoriesBar) {
      categoriesBar.addEventListener('click', function (e) {
        if (!e.target.classList.contains('cat-chip')) return;
        document.querySelectorAll('.cat-chip').forEach(function (c) { c.classList.remove('active'); });
        e.target.classList.add('active');
        var cat = e.target.getAttribute('data-cat');
        var newUrl = cat === 'all' ? '/' : '/?cat=' + encodeURIComponent(cat);
        window.history.replaceState({}, '', newUrl);
        if (cat === 'all') {
          renderProducts(allProducts);
          var countEl = document.getElementById('productCount');
          if (countEl) countEl.textContent = allProducts.length + ' product' + (allProducts.length !== 1 ? 's' : '');
        } else {
          var knownCategories = ['fashion', 'electronics', 'home', 'beauty'];
          var filtered = allProducts.filter(function (p) {
            var productCategory = String(p.category || '').trim().toLowerCase();
            return cat.toLowerCase() === 'others'
              ? productCategory !== '' && knownCategories.indexOf(productCategory) === -1
              : productCategory === cat.toLowerCase();
          });
          renderProducts(filtered);
          var ce = document.getElementById('productCount');
          if (ce) ce.textContent = filtered.length + ' product' + (filtered.length !== 1 ? 's' : '');
        }
      });
    }

    updateCartCount();
    loadProducts();

    window.addToCart = addToCart;
    window.filterProducts = filterProducts;
  })();
}

/* ===== Cart ===== */
if (["/cart.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;

    function getCart() {
      try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (_) { return []; }
    }
    function saveCart(cart) {
      try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (_) {}
    }

    function renderCart() {
      var cart = getCart();
      var container = document.getElementById('cartContent');
      if (!container) return;

      if (cart.length === 0) {
        container.innerHTML =
          '<div class="empty">' +
            '<h2>Your cart is empty</h2>' +
            '<p>Looks like you haven\'t added anything yet.</p>' +
            '<a href="/">Continue Shopping</a>' +
          '</div>';
        return;
      }

      var total = 0;
      var html = '';
      cart.forEach(function (item, index) {
        var qty = Number(item.quantity) || 1;
        var price = Number(item.price) || 0;
        total += price * qty;
        var itemImage = item.image || 'https://via.placeholder.com/90?text=No+Image';
        var itemName = item.name || 'Unnamed Product';

        html += '<div class="cart-item">';
        html +=   '<img src="' + esc(itemImage) + '" alt="' + esc(itemName) + '" onerror="this.src=\'https://via.placeholder.com/90?text=No+Image\'">';
        html +=   '<div class="cart-info">';
        html +=     '<h3>' + esc(itemName) + '</h3>';
        html +=     '<div class="cart-price">₦' + price.toLocaleString() + '</div>';
        html +=     '<div class="qty-controls">';
        html +=       '<button type="button" data-cart-action="dec" data-index="' + index + '">−</button>';
        html +=       '<span>' + qty + '</span>';
        html +=       '<button type="button" data-cart-action="inc" data-index="' + index + '">+</button>';
        html +=     '</div>';
        html +=     '<button type="button" class="remove-btn" data-cart-action="remove" data-index="' + index + '">Remove</button>';
        html +=   '</div>';
        html += '</div>';
      });

      var itemCount = cart.reduce(function (sum, item) { return sum + (Number(item.quantity) || 0); }, 0);
      html += '<div class="summary">';
      html +=   '<div class="summary-row"><span>Subtotal (' + itemCount + ' items)</span><span>₦' + total.toLocaleString() + '</span></div>';
      html +=   '<div class="summary-row"><span>Shipping</span><span>Calculated at checkout</span></div>';
      html +=   '<div class="summary-row total"><span>Total</span><span>₦' + total.toLocaleString() + '</span></div>';
      html +=   '<a href="/checkout.html" class="checkout-btn">Proceed to Checkout</a>';
      html +=   '<a href="/" style="display:inline-block;width:100%;text-align:center;margin-top:10px;padding:12px;border-radius:10px;border:1px solid var(--border);color:var(--text);text-decoration:none;">Continue Shopping</a>';
      html += '</div>';

      container.innerHTML = html;
    }

    function changeQty(index, delta) {
      var cart = getCart();
      if (!cart[index]) return;
      cart[index].quantity = (Number(cart[index].quantity) || 0) + delta;
      if (cart[index].quantity < 1) cart.splice(index, 1);
      saveCart(cart);
      renderCart();
    }
    function removeItem(index) {
      var cart = getCart();
      cart.splice(index, 1);
      saveCart(cart);
      renderCart();
    }

    var container = document.getElementById('cartContent');
    if (container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-cart-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-cart-action');
        var index = Number(btn.getAttribute('data-index'));
        if (action === 'inc') changeQty(index, 1);
        else if (action === 'dec') changeQty(index, -1);
        else if (action === 'remove') removeItem(index);
      });
    }

    renderCart();

    window.changeQty = changeQty;
    window.removeItem = removeItem;
  })();
}

/* ===== OAuth tool page ===== */
if (["/oauth.html"].includes(window.location.pathname)) {
  (function () {
    var params = new URLSearchParams(location.search);
    var code = params.get('code') || '';
    var err = params.get('error') || '';
    var statusEl = document.getElementById('status');
    if (!statusEl) return;

    if (err) {
      statusEl.className = 'err';
      statusEl.textContent = 'AliExpress error: ' + err;
    } else if (code) {
      statusEl.className = 'ok';
      statusEl.textContent = 'Code received. Copy it or click Get Access Token.';
      var codeBox = document.getElementById('codeBox');
      if (codeBox) codeBox.value = code;
    } else {
      statusEl.textContent = 'No code yet. Set this page as Callback URL, then authorize.';
      statusEl.innerHTML += '<br><br>Callback URL for AliExpress app:<br><code>https://shop.davilanco.com/oauth.html</code>';
    }

    function copyCode() {
      var t = document.getElementById('codeBox');
      if (!t) return;
      t.select();
      try { document.execCommand('copy'); alert('Code copied'); } catch (_) {}
    }

    async function getToken() {
      var cBox = document.getElementById('codeBox');
      var ts = document.getElementById('tokenStatus');
      if (!cBox || !ts) return;
      var c = cBox.value.trim();
      if (!c) {
        ts.className = 'err';
        ts.textContent = 'No code';
        return;
      }
      ts.textContent = 'Requesting token…';
      try {
        // Token exchange lives in /api/import-aliexpress ({action:'ae_token'}).
        var res = await fetch('/api/import-aliexpress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ae_token', code: c })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        var ab = document.getElementById('accessBox');
        var rb = document.getElementById('refreshBox');
        if (ab) ab.value = data.access_token || '';
        if (rb) rb.value = data.refresh_token || '';
        ts.className = 'ok';
        ts.textContent = 'Success. Copy tokens into Cloudflare env, then redeploy.';
      } catch (e) {
        ts.className = 'err';
        ts.textContent = e.message || 'Failed';
      }
    }

    window.copyCode = copyCode;
    window.getToken = getToken;
  })();
}

/* ===== Login page =====
   The shared capture-phase submit handler at the top of this file already
   handles /api/login for #loginForm. No page-specific logic is required here. */

/* ===== Verify page ===== */
if (["/verify.html"].includes(window.location.pathname)) {
  (function () {
    var params = new URLSearchParams(window.location.search);
    var emailField = document.getElementById('email');
    if (params.get('email') && emailField) emailField.value = params.get('email');

    async function confirmCode() {
      var msg = document.getElementById('msg');
      var email = (document.getElementById('email') || {}).value || '';
      var code = (document.getElementById('code') || {}).value || '';
      email = email.trim(); code = code.trim();
      if (!msg) return;
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
          setTimeout(function () { window.location.href = '/login.html'; }, 1200);
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
      var email = ((document.getElementById('email') || {}).value || '').trim();
      if (!msg) return;
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

    window.confirmCode = confirmCode;
    window.resendCode = resendCode;
  })();
}

/* ===== Signup page ===== */
if (["/signup.html"].includes(window.location.pathname)) {
  (function () {
    var referralParams = new URLSearchParams(window.location.search);
    var referralFromUrl = referralParams.get('ref');
    if (referralFromUrl) {
      try { localStorage.setItem('davilanco_referral_code', referralFromUrl.trim().toUpperCase()); } catch (_) {}
    }
    var referralInput = document.getElementById('referralCode');
    if (referralInput) {
      var stored = '';
      try { stored = localStorage.getItem('davilanco_referral_code') || ''; } catch (_) {}
      referralInput.value = (referralFromUrl || stored || '').trim().toUpperCase();
    }

    var form = document.getElementById('signupForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var msg = document.getElementById('msg');
      var btn = document.getElementById('submitBtn');
      var password = (document.getElementById('password') || {}).value || '';
      var password2 = (document.getElementById('password2') || {}).value || '';
      if (!msg || !btn) return;

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
            firstname: (document.getElementById('firstname') || {}).value || '',
            lastname: (document.getElementById('lastname') || {}).value || '',
            nickname: (document.getElementById('nickname') || {}).value || '',
            phone: (document.getElementById('phone') || {}).value || '',
            email: (document.getElementById('email') || {}).value || '',
            referral_code: referralInput ? referralInput.value.trim().toUpperCase() : '',
            password: password
          })
        });
        var data = await res.json();

        if (data.ok) {
          try { localStorage.removeItem('davilanco_referral_code'); } catch (_) {}
          msg.className = 'success';
          msg.innerHTML = 'Account created! Check your email for verification code. <br><a href="/verify.html" style="color:var(--gold)">Verify now</a>';
          form.reset();
          btn.textContent = 'Account Created';
        } else {
          msg.className = 'error';
          msg.textContent = data.error || 'Signup failed';
          btn.disabled = false;
          btn.textContent = 'Create Account';
        }
      } catch (err) {
        msg.className = 'error';
        msg.textContent = 'Network error: ' + err.message;
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });
  })();
}

/* ===== Product page ===== */
if (["/product.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;
    var urlParams = new URLSearchParams(window.location.search);
    var productId = urlParams.get('id');

    function addToCart(id, name, price, image, qty) {
      var quantity = Number(qty) || 1;
      var cart = [];
      try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (_) { cart = []; }
      var existing = cart.find(function (item) { return String(item.id) === String(id); });
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + quantity;
      } else {
        cart.push({ id: id, name: name, price: price, image: image, quantity: quantity });
      }
      try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (_) {}
      var toast = document.getElementById('toast');
      if (toast) {
        toast.style.display = 'block';
        setTimeout(function () { toast.style.display = 'none'; }, 2000);
      }
    }

    async function loadProduct() {
      var container = document.getElementById('productContent');
      if (!container) return;

      if (!productId) {
        container.innerHTML =
          '<div class="state-box">' +
            '<h2>Product not found</h2>' +
            '<p>No product ID provided.</p><br>' +
            '<a href="/"><button type="button">Back to Shop</button></a>' +
          '</div>';
        return;
      }

      try {
        var res = await fetch('/api/products');
        var data = await res.json();
        var products = Array.isArray(data) ? data : (data.results || []);
        var product = products.find(function (p) { return String(p.id) === String(productId); });

        if (!product) {
          container.innerHTML =
            '<div class="state-box">' +
              '<h2>Product not found</h2>' +
              '<p>This product may have been removed.</p><br>' +
              '<a href="/"><button type="button">Back to Shop</button></a>' +
            '</div>';
          return;
        }

        document.title = (product.name || 'Product') + ' – Davilanco';

        var price = Number(product.price || 0).toLocaleString();
        var oldPrice = product.old_price ? Number(product.old_price).toLocaleString() : null;
        var safeName = esc(product.name || 'Product');
        var safeImage = esc(product.image || 'https://via.placeholder.com/500x500?text=No+Image');
        var safeDesc = esc(product.description || 'No description available for this product.');
        var safeCategory = esc(product.category || 'General');

        var stockNum = Number(product.stock);
        var hasStock = !isNaN(stockNum);
        var inStock = hasStock ? stockNum > 0 : true;
        var stockLabel = hasStock ? (stockNum > 0 ? stockNum + ' in stock' : 'Out of stock') : 'Available';

        var oldPriceHtml = oldPrice ? '<span class="old-price">₦' + esc(oldPrice) + '</span>' : '';

        var cartButtonHtml = inStock
          ? '<button type="button" class="add-to-cart-btn" data-id="' + esc(product.id) + '">Add to Cart</button>'
          : '<button type="button" class="out-of-stock" disabled>Out of Stock</button>';

        var sellerBadgeHtml = product.seller_id
          ? '<div id="sellerBadgeWrap" style="margin-top:8px"><span class="seller-badge">Seller</span></div>'
          : '<div id="sellerBadgeWrap" style="margin-top:8px"><span class="seller-badge">Official Store</span></div>';

        container.innerHTML =
          '<div class="product-container">' +
            '<div>' +
              '<img class="product-image" src="' + safeImage + '" alt="' + safeName + '" ' +
                'onerror="this.src=\'https://via.placeholder.com/500x500?text=No+Image\'">' +
            '</div>' +
            '<div class="product-info">' +
              '<h1>' + esc(product.name || 'Unnamed Product') + '</h1>' +
              '<div class="price">₦' + esc(price) + oldPriceHtml + '</div>' +
              '<div class="meta">Category: ' + safeCategory + '<br>Stock: ' + esc(stockLabel) + '</div>' +
              sellerBadgeHtml +
              '<div class="description">' + safeDesc + '</div>' +
              '<div class="qty-row">' +
                '<label for="qty">Quantity:</label>' +
                '<input type="number" id="qty" value="1" min="1" max="' + (hasStock && stockNum > 0 ? stockNum : 99) + '"' + (inStock ? '' : ' disabled') + '>' +
              '</div>' +
              '<div class="actions">' +
                cartButtonHtml +
                '<a href="/cart.html"><button type="button" class="secondary" style="width:100%">View Cart</button></a>' +
              '</div>' +
            '</div>' +
          '</div>';

        var addBtn = container.querySelector('.add-to-cart-btn');
        if (addBtn) {
          addBtn.addEventListener('click', function () {
            var qtyEl = document.getElementById('qty');
            var qty = qtyEl ? (parseInt(qtyEl.value, 10) || 1) : 1;
            addToCart(
              product.id,
              product.name || 'Product',
              Number(product.price) || 0,
              product.image || '',
              qty
            );
          });
        }

        if (product.seller_id) {
          fetch('/api/seller?id=' + encodeURIComponent(product.seller_id))
            .then(function (r) { return r.json(); })
            .then(function (d) {
              var wrap = document.getElementById('sellerBadgeWrap');
              if (!wrap || !d.seller) return;
              var storeName = d.seller.store_name || d.seller.nickname || 'Seller';
              wrap.innerHTML = '<a class="seller-badge" href="/seller-profile.html?id=' + encodeURIComponent(d.seller.id) + '">Sold by ' + esc(storeName) + '</a>';
            })
            .catch(function () {});
        }
      } catch (err) {
        container.innerHTML =
          '<div class="state-box">' +
            '<h2>Could not load product</h2>' +
            '<p>Please try again later.</p><br>' +
            '<a href="/"><button type="button">Back to Shop</button></a>' +
          '</div>';
      }
    }

    loadProduct();
  })();
}

/* ===== Checkout page ===== */
if (["/checkout.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;

    var states = [
      'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
      'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
      'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
      'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'
    ];

    var BANK = {
      name: 'Davilanco',
      bank: 'Palmpay',
      number: '2981312023',
      note: 'Use your Order Reference as payment description'
    };

    function getCart() {
      try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (_) { return []; }
    }
    function getUser() {
      try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { return null; }
    }

    function renderCheckout() {
      var cart = getCart();
      var container = document.getElementById('checkoutContent');
      if (!container) return;
      if (!cart.length) {
        container.innerHTML = '<div class="empty"><h2>Your cart is empty</h2><a href="/">Continue Shopping</a></div>';
        return;
      }

      var total = 0;
      cart.forEach(function (item) { total += (Number(item.price) || 0) * (Number(item.quantity) || 0); });

      var stateOptions = '<option value="">Select State</option>';
      states.forEach(function (s) { stateOptions += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });

      var itemsHtml = '';
      cart.forEach(function (item) {
        itemsHtml += '<div class="summary-row"><span>' + esc(item.name || 'Item') + ' × ' + esc(item.quantity) + '</span><span>₦' + ((Number(item.price) || 0) * (Number(item.quantity) || 0)).toLocaleString() + '</span></div>';
      });

      container.innerHTML =
        '<form id="checkoutForm">' +
          '<div class="card"><h3>Delivery Details</h3>' +
            '<div class="row"><div><label>First Name *</label><input id="firstname" required></div>' +
            '<div><label>Last Name *</label><input id="lastname" required></div></div>' +
            '<label>Phone *</label><input type="tel" id="phone" required>' +
            '<label>Alternative Phone</label><input type="tel" id="alt_phone">' +
            '<label>Neighbor\'s Phone</label><input type="tel" id="neighbor_phone">' +
            '<label>Full Address *</label><textarea id="address" required></textarea>' +
            '<label>Town *</label><input id="town" required>' +
            '<label>LGA *</label><input id="lga" required>' +
            '<label>State *</label><select id="state" required>' + stateOptions + '</select>' +
          '</div>' +
          '<div class="card"><h3>Payment Method</h3>' +
            '<label class="payment-option selected"><input type="radio" name="payment" value="paystack" checked> Paystack (Card / Bank / USSD)</label>' +
            '<label class="payment-option"><input type="radio" name="payment" value="bank_transfer"> Bank Transfer</label>' +
            '<div id="bankDetails">' +
              '<strong>Bank Transfer Details</strong><br>' +
              'Account Name: ' + esc(BANK.name) + '<br>' +
              'Bank: ' + esc(BANK.bank) + '<br>' +
              'Account Number: ' + esc(BANK.number) + '<br>' +
              esc(BANK.note) +
            '</div>' +
          '</div>' +
          '<div class="card"><h3>Order Summary</h3>' +
            itemsHtml +
            '<div class="summary-row total"><span>Total</span><span>₦' + total.toLocaleString() + '</span></div>' +
          '</div>' +
          '<button type="submit" id="submitBtn">Place Order</button>' +
          '<p id="msg"></p>' +
        '</form>';

      document.querySelectorAll('.payment-option').forEach(function (opt) {
        opt.addEventListener('click', function () {
          document.querySelectorAll('.payment-option').forEach(function (o) { o.classList.remove('selected'); });
          opt.classList.add('selected');
          var input = opt.querySelector('input');
          if (input) input.checked = true;
          var method = input ? input.value : '';
          var bankDetails = document.getElementById('bankDetails');
          if (bankDetails) bankDetails.style.display = method === 'bank_transfer' ? 'block' : 'none';
        });
      });

      var form = document.getElementById('checkoutForm');
      if (form) form.addEventListener('submit', handleCheckout);
    }

    async function handleCheckout(e) {
      e.preventDefault();
      var msg = document.getElementById('msg');
      var btn = document.getElementById('submitBtn');
      var cart = getCart();
      var user = getUser();
      if (!msg || !btn) return;

      var firstname = (document.getElementById('firstname') || {}).value || '';
      var lastname = (document.getElementById('lastname') || {}).value || '';
      var phone = (document.getElementById('phone') || {}).value || '';
      var address = (document.getElementById('address') || {}).value || '';
      var town = (document.getElementById('town') || {}).value || '';
      var lga = (document.getElementById('lga') || {}).value || '';
      var state = (document.getElementById('state') || {}).value || '';
      var paymentEl = document.querySelector('input[name="payment"]:checked');
      var payment = paymentEl ? paymentEl.value : 'bank_transfer';

      if (!firstname.trim() || !lastname.trim() || !phone.trim() || !address.trim() || !town.trim() || !lga.trim() || !state) {
        msg.className = 'error';
        msg.textContent = 'Please fill all required fields';
        return;
      }

      var total = 0;
      cart.forEach(function (item) { total += (Number(item.price) || 0) * (Number(item.quantity) || 0); });

      var reference = 'DAV-' + Date.now();

      btn.disabled = true;
      btn.textContent = 'Processing...';
      msg.textContent = '';

      try {
        var orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
          },
          body: JSON.stringify({
            user_id: user ? user.id : null,
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            phone: phone.trim(),
            alt_phone: ((document.getElementById('alt_phone') || {}).value || '').trim(),
            neighbor_phone: ((document.getElementById('neighbor_phone') || {}).value || '').trim(),
            address: address.trim(),
            town: town.trim(),
            lga: lga.trim(),
            state: state,
            payment_method: payment,
            payment_reference: reference,
            items: cart,
            total: total
          })
        });

        var orderData = await orderRes.json();
        if (!orderData.ok) throw new Error(orderData.error || 'Could not create order');

        try {
          localStorage.setItem('lastOrder', JSON.stringify({
            reference: orderData.order_id,
            total: orderData.total,
            payment_method: payment,
            status: 'Pending'
          }));
        } catch (_) {}

        if (payment === 'paystack') {
          var email = (user && user.email) ? user.email : (phone.trim() + '@davilanco.customer');
          var initRes = await fetch('/api/paystack/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              amount: orderData.total,
              reference: orderData.order_id,
              order_id: orderData.order_id,
              callback_url: 'https://shop.davilanco.com/payment-success.html'
            })
          });
          var initData = await initRes.json();
          if (!initData.ok || !initData.authorization_url) {
            throw new Error(initData.error || 'Paystack initialization failed');
          }
          window.location.href = initData.authorization_url;
          return;
        }

        try { localStorage.removeItem('cart'); } catch (_) {}
        msg.className = 'success';
        msg.innerHTML = 'Order placed!<br>Reference: <strong>' + esc(orderData.order_id) + '</strong><br>Transfer the exact amount and use this reference as description. Admin will confirm payment.';
        btn.textContent = 'Order Placed';
        setTimeout(function () { window.location.href = '/dashboard.html'; }, 3500);
      } catch (err) {
        msg.className = 'error';
        msg.textContent = err.message || 'Something went wrong';
        btn.disabled = false;
        btn.textContent = 'Place Order';
      }
    }

    renderCheckout();
  })();
}

/* ===== Dashboard =====
   dashboard-auth.js runs first and sets window.dvlDashboardSessionUser
   after verifying /api/session. We wait for that value rather than
   firing a second session request, which eliminates the flicker and
   the redundant fetch. */
if (["/dashboard.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;
    var user = {};

    function text(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    }

   function initDashboard(u) {
  user = u || {};
  document.documentElement.classList.remove('davilanco-auth-pending');
  
  // Force the dashboard to be visible
  var mainEl = document.getElementById('dashboardPrivateContent');
  if (mainEl) {
    mainEl.hidden = false;
    mainEl.style.removeProperty('display');
  }

  try { localStorage.setItem('user', JSON.stringify(user)); } catch (_) {}

  var sellerLink = document.getElementById('sellerLink');
  if (sellerLink && (user.role === 'seller' || user.role === 'admin')) sellerLink.classList.remove('hidden');
  var adminLink = document.getElementById('adminLink');
  if (adminLink && user.role === 'admin') adminLink.classList.remove('hidden');

  text('nicknameDisplay', user.nickname || 'User');
  text('fullName', (user.firstname || '') + ' ' + (user.lastname || ''));
  text('nick', user.nickname || '–');
  text('phone', user.phone || '–');
  text('email', user.email || '–');
  text('role', user.role || 'customer');

  loadReferralStats();
  loadCartSummary();
  loadOrders();
  loadMessages();
}

function waitForSession() {
  // If dashboard-auth.js already finished, use its data immediately
  if (window.dvlDashboardSessionUser) {
    initDashboard(window.dvlDashboardSessionUser);
    return;
  }
  
  var tries = 0;
  var iv = setInterval(function () {
    if (window.dvlDashboardSessionUser) {
      clearInterval(iv);
      initDashboard(window.dvlDashboardSessionUser);
      return;
    }
    // After 2 seconds, fallback to fetching directly
    if (++tries > 40) {
      clearInterval(iv);
      fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok || !d.user || !d.user.id) throw new Error('Not logged in');
          initDashboard(d.user);
        })
        .catch(function () {
          try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
          window.location.replace('/login.html?redirect=' + encodeURIComponent('/dashboard.html'));
        });
    }
  }, 50);
     }

    function toggleEdit() {
      var form = document.getElementById('editForm');
      if (!form) return;
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) {
        var e1 = document.getElementById('e_firstname');
        var e2 = document.getElementById('e_lastname');
        var e3 = document.getElementById('e_phone');
        if (e1) e1.value = user.firstname || '';
        if (e2) e2.value = user.lastname || '';
        if (e3) e3.value = user.phone || '';
      }
    }

    function saveDetails() {
      var e1 = document.getElementById('e_firstname');
      var e2 = document.getElementById('e_lastname');
      var e3 = document.getElementById('e_phone');
      user.firstname = e1 ? e1.value.trim() : (user.firstname || '');
      user.lastname = e2 ? e2.value.trim() : (user.lastname || '');
      user.phone = e3 ? e3.value.trim() : (user.phone || '');
      try { localStorage.setItem('user', JSON.stringify(user)); } catch (_) {}
      text('fullName', (user.firstname || '') + ' ' + (user.lastname || ''));
      text('phone', user.phone || '');
      toggleEdit();
      alert('Details updated locally. (Full server save coming next)');
    }

    function changePassword() {
      var msg = document.getElementById('passMsg');
      var n1 = (document.getElementById('newPass') || {}).value || '';
      var n2 = (document.getElementById('newPass2') || {}).value || '';
      if (!msg) return;
      if (!n1 || n1 !== n2) { msg.style.color = '#e74c3c'; msg.textContent = 'New passwords do not match'; return; }
      if (n1.length < 8) { msg.style.color = '#e74c3c'; msg.textContent = 'Password must be at least 8 characters'; return; }
      msg.style.color = '#27ae60';
      msg.textContent = 'Password change will be connected to API next.';
    }

    async function loadReferralStats() {
      var codeEl = document.getElementById('myReferralCode');
      var linkEl = document.getElementById('myReferralLink');
      var countEl = document.getElementById('referralCount');
      var listEl = document.getElementById('referralList');
      var msgEl = document.getElementById('referralMsg');
      try {
        var res = await fetch('/api/referrals');
        var data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load referral information.');
        if (codeEl) codeEl.textContent = data.referral_code || '';
        if (linkEl) linkEl.value = data.referral_link || '';
        if (countEl) countEl.textContent = String(data.referral_count || 0);
        if (listEl) {
          if (!data.referrals || !data.referrals.length) {
            listEl.textContent = 'No referred sign-ups yet. Share your link to get started.';
          } else {
            var ul = document.createElement('ul');
            data.referrals.forEach(function (item) {
              var li = document.createElement('li');
              li.textContent = (item.nickname || 'Customer') + (item.created_at ? ' — ' + item.created_at : '');
              ul.appendChild(li);
            });
            listEl.innerHTML = '<strong>People who joined:</strong>';
            listEl.appendChild(ul);
          }
        }
      } catch (err) {
        if (msgEl) { msgEl.style.color = '#e74c3c'; msgEl.textContent = err.message || 'Could not load referral information.'; }
        if (listEl) listEl.textContent = 'Referral information is temporarily unavailable.';
      }
    }

    async function copyReferralLink() {
      var field = document.getElementById('myReferralLink');
      var msg = document.getElementById('referralMsg');
      if (!field) return;
      try {
        await navigator.clipboard.writeText(field.value);
        if (msg) { msg.style.color = '#27ae60'; msg.textContent = 'Referral link copied.'; }
      } catch (_) {
        field.focus(); field.select();
        if (msg) { msg.style.color = ''; msg.textContent = 'Select and copy the link above.'; }
      }
    }

    async function shareReferralLink() {
      var field = document.getElementById('myReferralLink');
      var link = field ? field.value : '';
      if (!link) return;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Join Davilanco', text: 'Create your Davilanco account using my referral link:', url: link });
        } catch (_) {}
      } else {
        await copyReferralLink();
      }
    }

    function loadCartSummary() {
      var box = document.getElementById('cartCard');
      if (!box) return;
      var cart = [];
      try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (_) { cart = []; }
      if (!cart.length) {
        box.innerHTML = '<p>Your cart is empty.</p><a href="/"><button type="button" style="margin-top:8px">Continue Shopping</button></a>';
        return;
      }
      var total = 0;
      var html = '';
      cart.forEach(function (item) {
        var qty = Number(item.quantity) || 0;
        var price = Number(item.price) || 0;
        total += price * qty;
        html += '<div class="order-item">' + esc(item.name || 'Item') + ' × ' + qty + ' — ₦' + (price * qty).toLocaleString() + '</div>';
      });
      html += '<p style="margin-top:10px"><strong>Total: ₦' + total.toLocaleString() + '</strong></p>';
      html += '<a href="/cart.html"><button type="button" style="margin-top:8px">View Cart / Checkout</button></a>';
      box.innerHTML = html;
    }

    async function loadOrders() {
      var list = document.getElementById('ordersList');
      if (!list) return;
      if (!user.id) { list.innerHTML = '<p style="opacity:0.7">Login to see your orders.</p>'; return; }
      try {
        var res = await fetch('/api/orders?user_id=' + encodeURIComponent(user.id));
        var data = await res.json();
        var orders = data.orders || [];
        if (!orders.length) {
          list.innerHTML = '<p style="opacity:0.7">No orders yet. <a href="/" style="color:var(--gold)">Shop now</a></p>';
          return;
        }
        var html = '';
        var latestTracked = null;
        orders.forEach(function (o) {
          var status = String(o.status || 'Pending').toLowerCase();
          var badge = 'pending';
          if (status.indexOf('approved') !== -1) badge = 'approved';
          if (status.indexOf('ship') !== -1 || status.indexOf('transit') !== -1) badge = 'shipping';
          if (status.indexOf('deliver') !== -1) badge = 'delivered';
          var itemsText = '';
          if (o.items && o.items.length) {
            itemsText = o.items.map(function (item) { return esc(item.product_name || 'Item') + ' × ' + esc(item.quantity); }).join(', ');
          }
          html += '<div class="order-item"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><strong>' + esc(o.id || '') + '</strong><span class="status ' + badge + '">' + esc(o.status || 'Pending') + '</span></div>';
          html += '<div style="margin-top:6px;font-size:13px;opacity:0.9">Total: ₦' + Number(o.total || 0).toLocaleString() + '<br>Payment: ' + esc(o.payment_method || '–') + ' · ' + esc(o.payment_status || 'pending') + '<br>Reference: <span style="color:var(--gold)">' + esc(o.payment_reference || o.id) + '</span>';
          if (itemsText) html += '<br>Items: ' + itemsText;
          if (o.tracking_number) {
            html += '<br>Tracking: ' + esc(o.tracking_number);
            if (o.logistics) html += ' (' + esc(o.logistics) + ')';
            if (o.eta) html += ' · ETA: ' + esc(o.eta);
            if (!latestTracked) latestTracked = o;
          }
          html += '</div></div>';
        });
        list.innerHTML = html;
        if (latestTracked) {
          text('courier', latestTracked.logistics || '–');
          text('trackingNo', latestTracked.tracking_number || '–');
          text('eta', latestTracked.eta || '–');
        }
      } catch (_) {
        list.innerHTML = '<p style="opacity:0.7">Could not load orders. Please refresh.</p>';
      }
    }

    async function loadMessages() {
      var box = document.getElementById('messagesBox');
      if (!box || !user || !user.id) return;
      try {
        var res = await fetch('/api/messages?user_id=' + encodeURIComponent(user.id));
        var data = await res.json();
        var msgs = data.messages || [];
        if (!msgs.length) { box.innerHTML = '<p style="opacity:0.7">No messages yet.</p>'; return; }
        box.innerHTML = msgs.map(function (m) {
          var who = (m.sender_role === 'admin') ? 'Admin' : 'You';
          return '<div style="margin-bottom:6px"><strong>' + who + ':</strong> ' + esc(m.message || '') + '</div>';
        }).join('');
      } catch (_) {
        box.innerHTML = '<p style="opacity:0.7">Could not load messages.</p>';
      }
    }

    async function sendMessage() {
      var input = document.getElementById('msgInput');
      if (!input) return;
      var message = input.value.trim();
      if (!message || !user || !user.id) return;
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
            message: message
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        input.value = '';
        loadMessages();
      } catch (err) {
        alert(err.message || 'Could not send');
      }
    }

    function applySeller() {
      var products = (document.getElementById('s_products') || {}).value || '';
      var address = (document.getElementById('s_address') || {}).value || '';
      var idnum = (document.getElementById('s_idnumber') || {}).value || '';
      var msg = document.getElementById('sellerMsg');
      if (!msg) return;
      if (!products.trim() || !address.trim() || !idnum.trim()) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Please fill all required fields';
        return;
      }
      msg.style.color = '#27ae60';
      msg.textContent = 'Application submitted (API connection coming next).';
    }

    // Wait for dashboard-auth.js to finish. Poll briefly, then fall back.
    function waitForSession() {
      if (window.dvlDashboardSessionUser) {
        initDashboard(window.dvlDashboardSessionUser);
        return;
      }
      var tries = 0;
      var iv = setInterval(function () {
        if (window.dvlDashboardSessionUser) {
          clearInterval(iv);
          initDashboard(window.dvlDashboardSessionUser);
          return;
        }
        if (++tries > 60) { // ~3s
          clearInterval(iv);
          fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d.ok || !d.user || !d.user.id) throw new Error('Not logged in');
              initDashboard(d.user);
            })
            .catch(function () {
              try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
              window.location.replace('/login.html?redirect=' + encodeURIComponent('/dashboard.html'));
            });
        }
      }, 50);
    }

    window.toggleEdit = toggleEdit;
    window.saveDetails = saveDetails;
    window.copyReferralLink = copyReferralLink;
    window.shareReferralLink = shareReferralLink;
    window.changePassword = changePassword;
    window.sendMessage = sendMessage;
    window.applySeller = applySeller;

    waitForSession();
  })();
}

/* ===== Payment success / verify ===== */
if (["/payment-success.html"].includes(window.location.pathname)) {
  (function () {
    var params = new URLSearchParams(window.location.search);
    var reference = params.get('reference') || params.get('trxref');

    async function verify() {
      var title = document.getElementById('title');
      var message = document.getElementById('message');
      var refEl = document.getElementById('ref');

      if (!reference) {
        if (title) title.textContent = 'No payment reference';
        if (message) { message.className = 'error'; message.textContent = 'We could not find a payment reference.'; }
        return;
      }

      if (refEl) refEl.textContent = 'Ref: ' + reference;

      try {
        var res = await fetch('/api/paystack/verify?reference=' + encodeURIComponent(reference));
        var data = await res.json();
        if (data.ok && data.paid) {
          if (title) title.textContent = 'Payment Successful';
          if (message) { message.className = 'success'; message.textContent = 'Your order has been paid. Thank you!'; }
          try { localStorage.removeItem('cart'); } catch (_) {}
        } else {
          if (title) title.textContent = 'Payment Not Completed';
          if (message) { message.className = 'error'; message.textContent = data.error || 'Payment was not successful. You can try again from checkout.'; }
        }
      } catch (_) {
        if (title) title.textContent = 'Verification Error';
        if (message) { message.className = 'error'; message.textContent = 'Could not verify payment. Contact support with your reference.'; }
      }
    }

    verify();
  })();
}

/* ===== Categories index ===== */
if (["/categories.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;

    var categoryItems = [
      { key: 'fashion', name: 'Fashion', icon: '👕', description: 'Clothing, shoes and accessories' },
      { key: 'electronics', name: 'Electronics', icon: '📱', description: 'Phones, gadgets and accessories' },
      { key: 'home', name: 'Home', icon: '🏠', description: 'Home, kitchen and living' },
      { key: 'beauty', name: 'Beauty', icon: '✨', description: 'Beauty and personal care' },
      { key: 'others', name: 'Others', icon: '🛍️', description: 'More products to discover' }
    ];

    var search = document.getElementById('searchBar');
    if (search) {
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && search.value.trim()) {
          window.location.href = '/?q=' + encodeURIComponent(search.value.trim());
        }
      });
    }

    (async function () {
      var grid = document.getElementById('categoryGrid');
      if (!grid) return;
      try {
        var r = await fetch('/api/products');
        if (!r.ok) throw new Error('Products unavailable');
        var d = await r.json();
        var products = Array.isArray(d) ? d : (d.results || []);
        grid.innerHTML = categoryItems.map(function (c) {
          var count = products.filter(function (p) {
            return String(p.category || '').toLowerCase() === c.key;
          }).length;
          return '<a class="category-card" href="/category.html?cat=' + encodeURIComponent(c.key) + '">' +
                   '<span class="category-icon">' + c.icon + '</span>' +
                   '<div><h2>' + esc(c.name) + '</h2><p>' + esc(c.description) + '</p>' +
                   '<div class="count">' + count + ' product' + (count === 1 ? '' : 's') + '</div></div>' +
                 '</a>';
        }).join('');
      } catch (_) {
        grid.innerHTML = categoryItems.map(function (c) {
          return '<a class="category-card" href="/category.html?cat=' + encodeURIComponent(c.key) + '">' +
                   '<span class="category-icon">' + c.icon + '</span>' +
                   '<div><h2>' + esc(c.name) + '</h2><p>' + esc(c.description) + '</p>' +
                   '<div class="count">Browse category →</div></div>' +
                 '</a>';
        }).join('');
      }
    })();
  })();
}

/* ===== Category detail ===== */
if (["/category.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;

    var categoryNames = { fashion: 'Fashion', electronics: 'Electronics', home: 'Home', beauty: 'Beauty', others: 'Others' };
    var params = new URLSearchParams(location.search);
    var category = (params.get('cat') || 'others').toLowerCase();
    var title = categoryNames[category] || 'Other products';
    document.title = title + ' | Davilanco';
    var titleEl = document.getElementById('categoryTitle');
    if (titleEl) titleEl.textContent = title;

    var products = [];
    var grid = document.getElementById('productsGrid');
    var count = document.getElementById('productCount');
    var search = document.getElementById('searchBar');
    var sort = document.getElementById('sortProducts');

    function render() {
      if (!grid) return;
      var q = search ? String(search.value || '').trim().toLowerCase() : '';
      var rows = products.filter(function (p) { return String(p.name || '').toLowerCase().indexOf(q) !== -1; });
      var sortValue = sort ? sort.value : '';
      if (sortValue === 'price-low') rows.sort(function (a, b) { return Number(a.price) - Number(b.price); });
      if (sortValue === 'price-high') rows.sort(function (a, b) { return Number(b.price) - Number(a.price); });
      if (sortValue === 'name') rows.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });

      if (count) count.textContent = rows.length + ' product' + (rows.length === 1 ? '' : 's');

      if (!rows.length) {
        grid.innerHTML = '<div class="state-box"><h3>No products found</h3><p>There are currently no products in this category.</p><a href="/categories.html">Browse other categories</a></div>';
        return;
      }

      grid.innerHTML = rows.map(function (p) {
        return '<article class="product-card">' +
                 '<a href="/product.html?id=' + encodeURIComponent(p.id) + '">' +
                   '<img src="' + esc(p.image || 'https://via.placeholder.com/400?text=No+Image') + '" alt="' + esc(p.name || 'Product') + '" loading="lazy">' +
                 '</a>' +
                 '<div class="product-info">' +
                   '<a class="product-name" href="/product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name || 'Product') + '</a>' +
                   '<div class="product-price">₦' + Number(p.price || 0).toLocaleString('en-NG') + '</div>' +
                   '<button type="button" class="add-btn" data-id="' + esc(p.id) + '">Add to Cart</button>' +
                 '</div>' +
               '</article>';
      }).join('');
    }

    if (grid) {
      grid.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.add-btn');
        if (!b) return;
        var p = products.find(function (x) { return String(x.id) === b.getAttribute('data-id'); });
        if (!p) return;
        var cart = [];
        try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (_) { cart = []; }
        var old = cart.find(function (x) { return String(x.id) === String(p.id); });
        if (old) old.quantity = (Number(old.quantity) || 1) + 1;
        else cart.push({ id: p.id, name: p.name, price: Number(p.price) || 0, image: p.image || '', quantity: 1 });
        try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (_) {}
        b.textContent = 'Added ✓';
        setTimeout(function () { b.textContent = 'Add to Cart'; }, 1200);
      });
    }

    if (search) search.addEventListener('input', render);
    if (sort) sort.addEventListener('change', render);

    (async function () {
      if (!grid) return;
      try {
        var r = await fetch('/api/products');
        if (!r.ok) throw new Error();
        var d = await r.json();
        var allProducts = Array.isArray(d) ? d : (d.results || []);
        var primaryCategories = ['fashion', 'electronics', 'home', 'beauty'];
        products = category === 'others'
          ? allProducts.filter(function (p) { return primaryCategories.indexOf(String(p.category || '').trim().toLowerCase()) === -1; })
          : allProducts.filter(function (p) { return String(p.category || '').trim().toLowerCase() === category; });
        render();
      } catch (_) {
        grid.innerHTML = '<div class="state-box">Could not load products. Please refresh.</div>';
        if (count) count.textContent = 'Unavailable';
      }
    })();
  })();
}

/* ===== Seller public profile ===== */
if (["/seller-profile.html"].includes(window.location.pathname)) {
  (function () {
    var esc = window.davilancoEsc;

    var params = new URLSearchParams(window.location.search);
    var sellerId = params.get('id') || '';
    var nickname = params.get('nickname') || '';
    var currentSeller = null;

    var me = null;
    try { me = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { me = null; }

    async function load() {
      var box = document.getElementById('content');
      if (!box) return;
      if (!sellerId && !nickname) {
        box.innerHTML = '<p>Seller not specified.</p><a href="/" style="color:var(--gold)">Back to shop</a>';
        return;
      }
      try {
        var q = sellerId
          ? '/api/seller?id=' + encodeURIComponent(sellerId)
          : '/api/seller?nickname=' + encodeURIComponent(nickname);
        var res = await fetch(q);
        var data = await res.json();
        if (!data.ok || !data.seller) throw new Error(data.error || 'Not found');

        currentSeller = data.seller;
        var s = data.seller;
        var store = s.store_name || s.nickname || 'Seller';
        var photo = s.photo || ('https://via.placeholder.com/72?text=' + encodeURIComponent(String(s.nickname || 'S').charAt(0)));

        var html = '';
        html += '<div class="card"><div class="profile-top">';
        html += '<img class="avatar" src="' + esc(photo) + '" alt="">';
        html += '<div><h1>' + esc(store) + '</h1>';
        html += '<div class="meta">@' + esc(s.nickname || '') + '<br>';
        if (s.phone) html += 'Phone: ' + esc(s.phone) + '<br>';
        if (s.email) html += 'Email: ' + esc(s.email);
        html += '</div></div></div>';
        if (s.bio) html += '<p style="margin-top:12px;font-size:14px">' + esc(s.bio) + '</p>';
        html += '</div>';

        html += '<div class="card"><h3 style="color:var(--gold);margin-bottom:8px">Message seller</h3>';
        if (!me) {
          html += '<p class="msg-note">Please <a href="/login.html?redirect=' + encodeURIComponent(location.pathname + location.search) + '" style="color:var(--gold)">login</a> to message this seller.</p>';
        } else {
          html += '<p class="msg-note">This messages the seller only. Admin chat stays on your dashboard.</p>';
          html += '<textarea id="sellerMsg" placeholder="Write a message..."></textarea>';
          html += '<button type="button" onclick="sendToSeller()">Send message</button>';
          html += '<p id="msgStatus" style="font-size:13px;margin-top:8px"></p>';
        }
        html += '</div>';

        html += '<div class="card"><h3 style="color:var(--gold);margin-bottom:12px">Products</h3>';
        var products = data.products || [];
        if (!products.length) {
          html += '<p style="opacity:0.7">No approved products yet.</p>';
        } else {
          html += '<div class="grid">';
          products.forEach(function (p) {
            html += '<a class="p-card" href="/product.html?id=' + encodeURIComponent(p.id) + '">';
            html += '<img src="' + esc(p.image || 'https://via.placeholder.com/200?text=No+Image') + '" alt="">';
            html += '<div><strong>' + esc(p.name || '') + '</strong><br>₦' + Number(p.price || 0).toLocaleString() + '</div>';
            html += '</a>';
          });
          html += '</div>';
        }
        html += '</div>';

        box.innerHTML = html;
        document.title = store + ' – Davilanco';
      } catch (_) {
        box.innerHTML = '<p>Could not load seller.</p><a href="/" style="color:var(--gold)">Back to shop</a>';
      }
    }

    async function sendToSeller() {
      if (!me || !currentSeller) return;
      var ta = document.getElementById('sellerMsg');
      var status = document.getElementById('msgStatus');
      if (!ta || !status) return;
      var text = ta.value.trim();
      if (!text) return;
      try {
        var res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: me.id,
            sender_role: me.role || 'customer',
            sender_name: me.nickname || 'Customer',
            receiver_id: currentSeller.id,
            receiver_role: 'seller',
            message: text
          })
        });
        var data = await res.json();
         if (!data.ok) throw new Error(data.error || 'Failed');
        ta.value = '';
        status.style.color = '#27ae60';
        status.textContent = 'Message sent';
      } catch (err) {
        status.style.color = '#e74c3c';
        status.textContent = err.message || 'Failed';
      }
    }

    window.sendToSeller = sendToSeller;
    load();
  })();
}
