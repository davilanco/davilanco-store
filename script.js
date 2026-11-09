/* Shared authenticated API transport and route guards. */
(function () {
  var path = window.location.pathname;
  var isAdminPage = path === '/admin/' || path.indexOf('/admin/') === 0;
  var isDashboard = path === '/dashboard.html';
  if (isAdminPage) document.documentElement.classList.add('davilanco-admin-page');
  var nativeFetch = window.fetch.bind(window);
  var adminSessionPromise = null;

  function goToLogin(destination) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('/login.html?redirect=' + encodeURIComponent(destination));
  }

  if (isAdminPage || isDashboard) {
    document.documentElement.classList.add('davilanco-auth-pending');
    var style = document.createElement('style');
    style.textContent = '.davilanco-auth-pending body > main{visibility:hidden}.davilanco-auth-pending body:after{content:"Checking your secure session…";display:block;text-align:center;padding:48px 16px;font:16px sans-serif}';
    document.head.appendChild(style);
  }

  if (isAdminPage) {
    adminSessionPromise = nativeFetch('/api/session', {
      credentials: 'same-origin', cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    }).then(async function (response) {
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok || !data.user || !data.user.id) {
        goToLogin(path + window.location.search);
        throw new Error(data.error || 'Please sign in to continue.');
      }
      if (data.user.role !== 'admin') {
        window.location.replace('/dashboard.html');
        throw new Error('Administrator access required.');
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      document.documentElement.classList.remove('davilanco-auth-pending');
      return data.user;
    }).catch(function (error) {
      if (!document.documentElement.classList.contains('davilanco-auth-pending')) throw error;
      if (error && error.message && !/Failed to fetch/i.test(error.message)) throw error;
      document.documentElement.classList.remove('davilanco-auth-pending');
      var main = document.querySelector('body > main');
      if (main) main.innerHTML = '<p role="alert">Could not verify your administrator session. Check your connection and refresh this page.</p>';
      throw error;
    });
  }

  if (isDashboard) {
    // The dashboard's own /api/session check removes this class after successful verification.
    // On failure it redirects to login, so private dashboard content stays hidden meanwhile.
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

    if (isAdminPage && parsed.pathname !== '/api/session' && parsed.pathname !== '/api/login' && parsed.pathname !== '/api/logout') {
      return (adminSessionPromise || Promise.resolve()).then(perform);
    }
    return perform();
  };
})();

/* Shared store navigation behavior. */
(() => {
  function getDrawer() { return document.getElementById('navDrawer'); }
  function setExpanded(open) {
    document.querySelectorAll('[onclick*="toggleNav"], [aria-controls="navDrawer"]').forEach((button) => {
      button.setAttribute('aria-expanded', String(open));
      button.classList.toggle('active', open);
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }
  const sharedToggleNav = function toggleNav() {
    const drawer = getDrawer();
    if (!drawer) return;
    const open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    setExpanded(open);
  };
  // Page-specific scripts may still declare their legacy toggleNav; reassert the shared handler after parsing.
  window.toggleNav = sharedToggleNav;
  function updateAccountNavigation() {
    const dashboardLinks = document.querySelectorAll('a[href="/dashboard.html"]');
    const sellerLinks = document.querySelectorAll('a[href="/seller/"]');
    const adminLinks = document.querySelectorAll('a[href="/admin/"], a[href="/admin"]');
    dashboardLinks.forEach((link) => { link.hidden = true; link.classList.add('hidden'); });
    sellerLinks.forEach((link) => { link.hidden = true; link.classList.add('hidden'); });
    adminLinks.forEach((link) => { link.hidden = true; link.classList.add('hidden'); });
    fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data || !data.ok || !data.user || !data.user.id) return;
        dashboardLinks.forEach((link) => { link.hidden = false; link.classList.remove('hidden'); });
        if (data.user.role === 'seller' || data.user.role === 'admin')
          sellerLinks.forEach((link) => { link.hidden = false; link.classList.remove('hidden'); });
        if (data.user.role === 'admin')
          adminLinks.forEach((link) => { link.hidden = false; link.classList.remove('hidden'); });
      }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateAccountNavigation);
  else updateAccountNavigation();
  document.addEventListener('DOMContentLoaded', () => { window.toggleNav = sharedToggleNav; });
  document.addEventListener('click', async (event) => {
    const logout = event.target.closest && event.target.closest('#logoutBtn');
    if (!logout) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('/login.html');
  }, true);
  // Reliable shared login controls. This capture-phase fallback runs before page-specific handlers.
  window.togglePasswordVisibility = function (fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.type = field.type === 'password' ? 'text' : 'password';
  };

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!form || form.id !== 'loginForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const msg = document.getElementById('msg');
    const button = document.getElementById('submitBtn');
    const login = document.getElementById('login');
    const password = document.getElementById('password');
    if (!msg || !button || !login || !password) return;

    button.disabled = true;
    button.textContent = 'Logging in...';
    msg.className = '';
    msg.textContent = 'Connecting to the login service...';

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ login: login.value.trim(), password: password.value })
      });
      const raw = await response.text();
      let data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch (_) { throw new Error('The login service returned an unexpected response (HTTP ' + response.status + ').'); }

      if (!response.ok || !data.ok) {
        msg.className = 'error';
        msg.textContent = (data.error || 'Login failed.') + ' (HTTP ' + response.status + ')';
        if (data.needs_verification && data.email) {
          const link = document.createElement('a');
          link.href = '/verify.html?email=' + encodeURIComponent(data.email);
          link.textContent = 'Verify your email';
          msg.append(document.createElement('br'), link);
        }
        return;
      }

      if (!data.token || !data.user || !data.user.id) {
        throw new Error('The login service did not return the expected session details.');
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      const params = new URLSearchParams(window.location.search);
      const requested = params.get('redirect') || '';
      let destination = data.user.role === 'admin' ? '/admin/' :
        (data.user.role === 'seller' ? '/seller/' : '/dashboard.html');
      try {
        const target = new URL(requested, window.location.origin);
        if (requested.startsWith('/') && !requested.startsWith('//') &&
            !requested.includes(String.fromCharCode(92)) && target.origin === window.location.origin) {
          destination = target.pathname + target.search + target.hash;
        }
      } catch (_) {}

      msg.className = 'success';
      msg.textContent = 'Login successful! Redirecting...';
      window.setTimeout(() => window.location.assign(destination), 500);
    } catch (error) {
      console.error('[Davilanco login fallback]', error);
      msg.className = 'error';
      msg.textContent = error.message || 'Could not connect to the login service. Please try again.';
    } finally {
      button.disabled = false;
      if (button.textContent === 'Logging in...') button.textContent = 'Login';
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const drawer = getDrawer();
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        setExpanded(false);
      }
    }
  });
})();


/* ===== Consolidated page and analytics scripts ===== */

/* ===== analytics.js ===== */
(function () {
/* Davilanco analytics: GA4 + first-party daily metrics. No personal form data is collected. */
(function () {
  'use strict';
  var measurementId = 'G-PVEHSCE72P';

  // Google Analytics 4
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: true });
  var gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  document.head.appendChild(gaScript);

  // First-party, privacy-minimised metrics for the Davilanco admin dashboard.
  try {
    var visitorId = localStorage.getItem('davilanco_analytics_visitor');
    if (!visitorId) {
      visitorId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
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
    }).catch(function () { /* Analytics must never interrupt shopping. */ });

    if (productId && typeof window.gtag === 'function') {
      gtag('event', 'view_item', { item_id: productId, page_location: window.location.href });
    }
  } catch (e) {
    // Privacy settings or browser storage restrictions should not break the store.
  }
})();

})();

/* ===== js/pages/index.js ===== */
if (["/","/index.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from index.html */
// ========== THEME ==========
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

    // ========== AUTH ==========
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user = null;

    if (token && userStr) {
      try {
        user = JSON.parse(userStr);
        document.getElementById('loginLink').style.display = 'none';
        document.getElementById('signupLink').style.display = 'none';
        document.getElementById('logoutLink').style.display = 'block';

        if (user.role === 'seller' || user.role === 'admin') {
          document.getElementById('sellerLink').style.display = 'block';
        }
        if (user.role === 'admin') {
          document.getElementById('adminLink').style.display = 'block';
        }
      } catch (e) {
        localStorage.clear();
      }
    }

    document.getElementById('logoutLink').addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    });

    // ========== BACK TO TOP ==========
    window.addEventListener('scroll', function() {
      document.getElementById('backToTop').style.display = window.scrollY > 400 ? 'block' : 'none';
    });

    // ========== CART ==========
    function getCart() {
      try {
        return JSON.parse(localStorage.getItem('cart') || '[]');
      } catch (e) {
        return [];
      }
    }

    function saveCart(cart) {
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartCount();
    }

    function updateCartCount() {
      const cart = getCart();
      let total = 0;
      cart.forEach(function(item) {
        total += item.quantity;
      });
      document.getElementById('cartCount').textContent = total;
    }

    function addToCart(id, name, price, image) {
      const cart = getCart();
      const existing = cart.find(function(item) {
        return item.id === id;
      });

      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          id: id,
          name: name,
          price: price,
          image: image,
          quantity: 1
        });
      }

      saveCart(cart);

      // Show toast
      const toast = document.getElementById('toast');
      toast.style.display = 'block';
      setTimeout(function() {
        toast.style.display = 'none';
      }, 1800);
    }

    // ========== PRODUCTS ==========
    let allProducts = [];

    async function loadProducts() {
      const grid = document.getElementById('productsGrid');
      const countEl = document.getElementById('productCount');

      try {
        const res = await fetch('/api/products');
        const data = await res.json();

        allProducts = Array.isArray(data) ? data : (data.results || []);

        // Check URL category
        const urlParams = new URLSearchParams(window.location.search);
        const catFromUrl = urlParams.get('cat');

        if (catFromUrl && catFromUrl !== 'all') {
          document.querySelectorAll('.cat-chip').forEach(function(chip) {
            chip.classList.remove('active');
            if (chip.getAttribute('data-cat') === catFromUrl) {
              chip.classList.add('active');
            }
          });

          const filtered = allProducts.filter(function(p) {
            return (p.category || '').toLowerCase() === catFromUrl.toLowerCase();
          });
          renderProducts(filtered);
          countEl.textContent = filtered.length + ' product' + (filtered.length !== 1 ? 's' : '');
        } else {
          renderProducts(allProducts);
          countEl.textContent = allProducts.length + ' product' + (allProducts.length !== 1 ? 's' : '');
        }

        if (allProducts.length === 0) {
          grid.innerHTML = '<div class="state-box"><h3>No products yet</h3><p>Check back soon.</p></div>';
        }

      } catch (err) {
        grid.innerHTML = '<div class="state-box"><h3>Could not load products</h3><p>Please refresh the page.</p></div>';
        countEl.textContent = 'Error';
      }
    }

    function renderProducts(products) {
  const grid = document.getElementById('productsGrid');

  if (!products || products.length === 0) {
    grid.innerHTML = '<div class="state-box"><h3>No products found</h3><p>Try a different category or search.</p></div>';
    return;
  }

  let html = '';

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const id = p.id || '';
    const name = p.name || 'Unnamed Product';
    const price = Number(p.price || 0);
    const oldPrice = Number(p.old_price || 0);
    const image = p.image || 'https://via.placeholder.com/300x300?text=No+Image';

    // Escape single quotes for the onclick
    const safeName = name.replace(/'/g, "\\'");

    html += '<div class="product-card">';
    html +=   '<a href="/product.html?id=' + id + '" class="product-img-link">';
    html +=     '<img class="product-img" src="' + image + '" alt="' + name + '" onerror="this.src=\'https://via.placeholder.com/300x300?text=No+Image\'">';
    html +=   '</a>';
    html +=   '<div class="product-info">';
    html +=     '<a href="/product.html?id=' + id + '" class="product-name">' + name + '</a>';
    html +=     '<div class="product-price">₦' + price.toLocaleString();
    if (oldPrice > 0) {
      html += ' <small><s>₦' + oldPrice.toLocaleString() + '</s></small>';
    }
    html +=     '</div>';
    html +=     '<button class="add-btn" onclick="addToCart(\'' + id + '\', \'' + safeName + '\', ' + price + ', \'' + image + '\')">Add to Cart</button>';
    html +=   '</div>';
    html += '</div>';
  }

  grid.innerHTML = html;
    }


    function filterProducts(query) {
      const q = query.toLowerCase().trim();
      if (!q) {
        renderProducts(allProducts);
        return;
      }
      const filtered = allProducts.filter(function(p) {
        return (p.name || '').toLowerCase().includes(q) ||
               (p.category || '').toLowerCase().includes(q);
      });
      renderProducts(filtered);
    }

    // Category chips
    document.getElementById('categoriesBar').addEventListener('click', function(e) {
      if (!e.target.classList.contains('cat-chip')) return;

      document.querySelectorAll('.cat-chip').forEach(function(c) {
        c.classList.remove('active');
      });
      e.target.classList.add('active');

      const cat = e.target.getAttribute('data-cat');

      // Update URL
      const newUrl = cat === 'all' ? '/' : '/?cat=' + cat;
      window.history.replaceState({}, '', newUrl);

      if (cat === 'all') {
        renderProducts(allProducts);
        document.getElementById('productCount').textContent = allProducts.length + ' product' + (allProducts.length !== 1 ? 's' : '');
      } else {
        const knownCategories = ['fashion', 'electronics', 'home', 'beauty'];
        const filtered = allProducts.filter(function(p) {
          const productCategory = String(p.category || '').trim().toLowerCase();
          return cat.toLowerCase() === 'others'
            ? productCategory !== '' && !knownCategories.includes(productCategory)
            : productCategory === cat.toLowerCase();
        });
        renderProducts(filtered);
        document.getElementById('productCount').textContent = filtered.length + ' product' + (filtered.length !== 1 ? 's' : '');
      }
    });

    // Start
    updateCartCount();
    loadProducts();
  if (typeof addToCart === "function") window.addToCart = addToCart;
  if (typeof filterProducts === "function") window.filterProducts = filterProducts;
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  })();
}

/* ===== js/pages/cart.js ===== */
if (["/cart.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from cart.html */
// ========== THEME ==========
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

    // ========== AUTH ==========
    const token = localStorage.getItem('token');
    const loginLink = document.getElementById('loginLink');
    const logoutLink = document.getElementById('logoutLink');

    if (token) {
      loginLink.style.display = 'none';
      logoutLink.style.display = 'block';
    }

    logoutLink?.addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    });

    // ========== BACK TO TOP ==========
    window.addEventListener('scroll', function() {
      document.getElementById('backToTop').style.display = window.scrollY > 300 ? 'block' : 'none';
    });

    // ========== CART LOGIC ==========
    function getCart() {
      try {
        return JSON.parse(localStorage.getItem('cart') || '[]');
      } catch (e) {
        return [];
      }
    }

    function saveCart(cart) {
      localStorage.setItem('cart', JSON.stringify(cart));
    }

    function renderCart() {
      const cart = getCart();
      const container = document.getElementById('cartContent');

      if (cart.length === 0) {
        container.innerHTML = `
          <div class="empty">
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added anything yet.</p>
            <a href="/">Continue Shopping</a>
          </div>
        `;
        return;
      }

      let total = 0;
      let html = '';

      cart.forEach(function(item, index) {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const itemImage = item.image || 'https://via.placeholder.com/90?text=No+Image';
        const itemName = item.name || 'Unnamed Product';
        const itemPrice = Number(item.price || 0).toLocaleString();

        html += `
          <div class="cart-item">
            <img src="${itemImage}" alt="${itemName}" onerror="this.src='https://via.placeholder.com/90?text=No+Image'">
            <div class="cart-info">
              <h3>${itemName}</h3>
              <div class="cart-price">₦${itemPrice}</div>
              <div class="qty-controls">
                <button onclick="changeQty(${index}, -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="changeQty(${index}, 1)">+</button>
              </div>
              <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
            </div>
          </div>
        `;
      });

      html += `
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal (${cart.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
            <span>₦${total.toLocaleString()}</span>
          </div>
          <div class="summary-row">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
          <div class="summary-row total">
            <span>Total</span>
            <span>₦${total.toLocaleString()}</span>
          </div>
          <a href="/checkout.html" class="checkout-btn">Proceed to Checkout</a>
          <a href="/" style="display:inline-block; width:100%; text-align:center; margin-top:10px; padding:12px; border-radius:10px; border:1px solid var(--border); color:var(--text); text-decoration:none;">Continue Shopping</a>
        </div>
      `;

      container.innerHTML = html;
    }

    function changeQty(index, delta) {
      const cart = getCart();
      cart[index].quantity += delta;

      if (cart[index].quantity < 1) {
        cart.splice(index, 1);
      }

      saveCart(cart);
      renderCart();
    }

    function removeItem(index) {
      const cart = getCart();
      cart.splice(index, 1);
      saveCart(cart);
      renderCart();
    }

    // Load cart when page opens
    renderCart();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  })();
}

/* ===== js/pages/oauth.js ===== */
if (["/oauth.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from oauth.html */
var params = new URLSearchParams(location.search);
    var code = params.get('code') || '';
    var err = params.get('error') || '';
    var status = document.getElementById('status');

    if (err) {
      status.className = 'err';
      status.textContent = 'AliExpress error: ' + err;
    } else if (code) {
      status.className = 'ok';
      status.textContent = 'Code received. Copy it or click Get Access Token.';
      document.getElementById('codeBox').value = code;
    } else {
      status.textContent = 'No code yet. Set this page as Callback URL, then authorize.';
      // Build authorize link if user pastes app key manually later; for now show instructions
      status.innerHTML += '<br><br>Callback URL for AliExpress app:<br><code>https://shop.davilanco.com/oauth.html</code>';
    }

    function copyCode() {
      var t = document.getElementById('codeBox');
      t.select();
      document.execCommand('copy');
      alert('Code copied');
    }

    async function getToken() {
      var c = document.getElementById('codeBox').value.trim();
      var ts = document.getElementById('tokenStatus');
      if (!c) {
        ts.className = 'err';
        ts.textContent = 'No code';
        return;
      }
      ts.textContent = 'Requesting token…';
      try {
        var res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ae_token', code: c })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        document.getElementById('accessBox').value = data.access_token || '';
        document.getElementById('refreshBox').value = data.refresh_token || '';
        ts.className = 'ok';
        ts.textContent = 'Success. Copy tokens into Cloudflare env, then redeploy.';
      } catch (e) {
        ts.className = 'err';
        ts.textContent = e.message || 'Failed';
      }
    }
  if (typeof copyCode === "function") window.copyCode = copyCode;
  if (typeof getToken === "function") window.getToken = getToken;
  })();
}

/* ===== js/pages/login.js ===== */
if (["/login.html"].includes(window.location.pathname)) {
  (function () {
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
    var requestedRedirect = urlParams.get('redirect') || '';
    var redirectTo = '';
    try {
      var redirectUrl = new URL(requestedRedirect, window.location.origin);
      if (requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//') &&
          requestedRedirect.indexOf(String.fromCharCode(92)) === -1 && redirectUrl.origin === window.location.origin) {
        redirectTo = redirectUrl.pathname + redirectUrl.search + redirectUrl.hash;
      }
    } catch (_) {}

    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var msg = document.getElementById('msg');
      var btn = document.getElementById('submitBtn');
      var succeeded = false;
      btn.disabled = true;
      btn.textContent = 'Logging in...';
      msg.className = '';
      msg.textContent = 'Connecting to the login service...';

      try {
        var res = await fetch('/api/login', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            login: document.getElementById('login').value.trim(),
            password: document.getElementById('password').value
          })
        });
        var raw = await res.text();
        var data;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (_) {
          throw new Error('The login API returned a non-JSON response (HTTP ' + res.status + '). Check that /api/login is deployed as a Cloudflare Function.');
        }

        if (!res.ok || !data.ok) {
          msg.className = 'error';
          msg.textContent = (data.error || 'Login failed.') + ' (HTTP ' + res.status + ')';
          if (data.needs_verification && data.email) {
            var verifyLink = document.createElement('a');
            verifyLink.href = '/verify.html?email=' + encodeURIComponent(data.email);
            verifyLink.textContent = 'Verify your email';
            verifyLink.style.color = 'var(--gold)';
            msg.appendChild(document.createElement('br'));
            msg.appendChild(verifyLink);
          }
          return;
        }

        if (!data.token || !data.user || !data.user.id) {
          throw new Error('The login API responded successfully but did not return the session details.');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (!redirectTo) redirectTo = data.user.role === 'admin' ? '/admin/' : (data.user.role === 'seller' ? '/seller/' : '/dashboard.html');
        msg.className = 'success';
        msg.textContent = 'Login successful! Redirecting...';
        succeeded = true;
        setTimeout(function() { window.location.assign(redirectTo); }, 500);
      } catch (error) {
        console.error('[Davilanco login]', error);
        msg.className = 'error';
        msg.textContent = error.message || 'Could not connect to the login service. Check your internet connection and try again.';
      } finally {
        if (!succeeded) {
          btn.disabled = false;
          btn.textContent = 'Login';
        }
      }
    });
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof togglePasswordVisibility === "function") window.togglePasswordVisibility = togglePasswordVisibility;
  })();
}

/* ===== js/pages/verify.js ===== */
if (["/verify.html"].includes(window.location.pathname)) {
  (function () {
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
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof confirmCode === "function") window.confirmCode = confirmCode;
  if (typeof resendCode === "function") window.resendCode = resendCode;
  })();
}

/* ===== js/pages/signup.js ===== */
if (["/signup.html"].includes(window.location.pathname)) {
  (function () {
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

  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof togglePasswordVisibility === "function") window.togglePasswordVisibility = togglePasswordVisibility;
  })();
}

/* ===== js/pages/product.js ===== */
if (["/product.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from product.html */
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

    // ========== AUTH STATE ==========
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user = null;

    if (token && userStr) {
      try {
        user = JSON.parse(userStr);
        document.getElementById('loginLink').style.display = 'none';
        document.getElementById('logoutLink').style.display = 'block';

        if (user.role === 'seller' || user.role === 'admin') {
          document.getElementById('sellerLink').style.display = 'block';
        }
        if (user.role === 'admin') {
          document.getElementById('adminLink').style.display = 'block';
        }
      } catch (e) {
        localStorage.clear();
      }
    }

    document.getElementById('logoutLink')?.addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    });

    // ========== BACK TO TOP ==========
    window.addEventListener('scroll', function() {
      document.getElementById('backToTop').style.display = window.scrollY > 300 ? 'block' : 'none';
    });

    // ========== LOAD PRODUCT ==========
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    async function loadProduct() {
      const container = document.getElementById('productContent');

      if (!productId) {
        container.innerHTML = `
          <div class="state-box">
            <h2>Product not found</h2>
            <p>No product ID provided.</p>
            <br>
            <a href="/"><button>Back to Shop</button></a>
          </div>
        `;
        return;
      }

      try {
        // Try to fetch single product (we will improve the API later)
        // For now we fetch all and find the matching one
        const res = await fetch('/api/products');
        const data = await res.json();
        const products = Array.isArray(data) ? data : (data.results || []);

        const product = products.find(p => p.id === productId);

        if (!product) {
          container.innerHTML = `
            <div class="state-box">
              <h2>Product not found</h2>
              <p>This product may have been removed.</p>
              <br>
              <a href="/"><button>Back to Shop</button></a>
            </div>
          `;
          return;
        }

        // Update page title
        document.title = (product.name || 'Product') + ' – Davilanco';

        const price = Number(product.price || 0).toLocaleString();
        const oldPrice = product.old_price ? Number(product.old_price).toLocaleString() : null;
        const safeName = (product.name || '').replace(/'/g, "\\'");

        let oldPriceHtml = '';
        if (oldPrice) {
          oldPriceHtml = `<span class="old-price">₦${oldPrice}</span>`;
        }

        const stockNum = Number(product.stock);
        const hasStock = !isNaN(stockNum);
        const inStock = hasStock ? stockNum > 0 : true;
        const stockLabel = hasStock
          ? (stockNum > 0 ? stockNum + ' in stock' : 'Out of stock')
          : 'Available';

        const safeImage = (product.image || '').replace(/'/g, "\\'");

        const cartButton = inStock
          ? `<button onclick="addToCart('\( {product.id}', ' \){safeName}', \( {product.price || 0}, ' \){safeImage}')">Add to Cart</button>`
          : `<button class="out-of-stock" disabled>Out of Stock</button>`;

        const sellerBadgeHtml = product.seller_id
          ? `<div id="sellerBadgeWrap" style="margin-top:8px"><span class="seller-badge">Seller</span></div>`
          : `<div id="sellerBadgeWrap" style="margin-top:8px"><span class="seller-badge">Official Store</span></div>`;

        container.innerHTML = `
          <div class="product-container">
            <div>
              <img 
                class="product-image" 
                src="${product.image || 'https://via.placeholder.com/500x500?text=No+Image'}" 
                alt="${product.name || 'Product'}"
                onerror="this.src='https://via.placeholder.com/500x500?text=No+Image'"
              >
            </div>

            <div class="product-info">
              <h1>${product.name || 'Unnamed Product'}</h1>
              
              <div class="price">
                ₦${price}
                ${oldPriceHtml}
              </div>

              <div class="meta">
                Category: ${product.category || 'General'}<br>
                Stock: ${stockLabel}
              </div>

              ${sellerBadgeHtml}

              <div class="description">
                ${product.description || 'No description available for this product.'}
              </div>

              <div class="qty-row">
                <label for="qty">Quantity:</label>
                <input type="number" id="qty" value="1" min="1" max="${hasStock && stockNum > 0 ? stockNum : 99}" ${inStock ? '' : 'disabled'}>
              </div>

              <div class="actions">
                ${cartButton}
                <a href="/cart.html">
                  <button class="secondary" style="width:100%">View Cart</button>
                </a>
              </div>
            </div>
          </div>
        `;

        // Load seller name into badge (clickable)
        if (product.seller_id) {
          fetch('/api/seller?id=' + encodeURIComponent(product.seller_id))
            .then(function(r) { return r.json(); })
            .then(function(d) {
              var wrap = document.getElementById('sellerBadgeWrap');
              if (!wrap || !d.seller) return;
              var name = d.seller.store_name || d.seller.nickname || 'Seller';
              wrap.innerHTML =
                '<a class="seller-badge" href="/seller-profile.html?id=' + d.seller.id + '">' +
                'Sold by ' + name +
                '</a>';
            })
            .catch(function() {});
    }
        
      } catch (err) {
        container.innerHTML = `
          <div class="state-box">
            <h2>Could not load product</h2>
            <p>Please try again later.</p>
            <br>
            <a href="/"><button>Back to Shop</button></a>
          </div>
        `;
      }
    }

    // ========== ADD TO CART (localStorage for now) ==========
    function addToCart(id, name, price, image) {
      const qty = parseInt(document.getElementById('qty').value) || 1;

      let cart = [];
      try {
        cart = JSON.parse(localStorage.getItem('cart') || '[]');
      } catch (e) {
        cart = [];
      }

      const existing = cart.find(item => item.id === id);

      if (existing) {
        existing.quantity += qty;
      } else {
        cart.push({
          id: id,
          name: name,
          price: price,
          image: image,
          quantity: qty
        });
      }

      localStorage.setItem('cart', JSON.stringify(cart));

      // Show toast
      const toast = document.getElementById('toast');
      toast.style.display = 'block';
      setTimeout(function() {
        toast.style.display = 'none';
      }, 2000);
    }

    // Load product when page opens
    loadProduct();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  })();
}

/* ===== js/pages/checkout.js ===== */
if (["/checkout.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from checkout.html */
const savedTheme = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    }

    const states = [
      'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
      'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
      'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
      'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'
    ];

    // === EDIT YOUR BANK DETAILS HERE ===
    const BANK = {
      name: 'Davilanco',
      bank: 'Palmpay',
      number: '2981312023',
      note: 'Use your Order Reference as payment description'
    };

    function getCart() {
      try { return JSON.parse(localStorage.getItem('cart') || '[]'); }
      catch (e) { return []; }
    }

    function getUser() {
      try { return JSON.parse(localStorage.getItem('user') || 'null'); }
      catch (e) { return null; }
    }

    function renderCheckout() {
      const cart = getCart();
      const container = document.getElementById('checkoutContent');

      if (!cart.length) {
        container.innerHTML = '<div class="empty"><h2>Your cart is empty</h2><a href="/">Continue Shopping</a></div>';
        return;
      }

      let total = 0;
      cart.forEach(function(item) { total += item.price * item.quantity; });

      let stateOptions = '<option value="">Select State</option>';
      states.forEach(function(s) {
        stateOptions += '<option value="' + s + '">' + s + '</option>';
      });

      let itemsHtml = '';
      cart.forEach(function(item) {
        itemsHtml += '<div class="summary-row"><span>' + item.name + ' × ' + item.quantity + '</span><span>₦' + (item.price * item.quantity).toLocaleString() + '</span></div>';
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
              'Account Name: ' + BANK.name + '<br>' +
              'Bank: ' + BANK.bank + '<br>' +
              'Account Number: ' + BANK.number + '<br>' +
              BANK.note +
            '</div>' +
          '</div>' +

          '<div class="card"><h3>Order Summary</h3>' +
            itemsHtml +
            '<div class="summary-row total"><span>Total</span><span>₦' + total.toLocaleString() + '</span></div>' +
          '</div>' +

          '<button type="submit" id="submitBtn">Place Order</button>' +
          '<p id="msg"></p>' +
        '</form>';

      // Payment option UI
      document.querySelectorAll('.payment-option').forEach(function(opt) {
        opt.addEventListener('click', function() {
          document.querySelectorAll('.payment-option').forEach(function(o) { o.classList.remove('selected'); });
          opt.classList.add('selected');
          opt.querySelector('input').checked = true;
          const method = opt.querySelector('input').value;
          document.getElementById('bankDetails').style.display = method === 'bank_transfer' ? 'block' : 'none';
        });
      });

      document.getElementById('checkoutForm').addEventListener('submit', handleCheckout);
    }

    async function handleCheckout(e) {
      e.preventDefault();
      const msg = document.getElementById('msg');
      const btn = document.getElementById('submitBtn');
      const cart = getCart();
      const user = getUser();

      const firstname = document.getElementById('firstname').value.trim();
      const lastname = document.getElementById('lastname').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const address = document.getElementById('address').value.trim();
      const town = document.getElementById('town').value.trim();
      const lga = document.getElementById('lga').value.trim();
      const state = document.getElementById('state').value;
      const payment = document.querySelector('input[name="payment"]:checked').value;

      if (!firstname || !lastname || !phone || !address || !town || !lga || !state) {
        msg.className = 'error';
        msg.textContent = 'Please fill all required fields';
        return;
      }

      let total = 0;
      cart.forEach(function(item) { total += item.price * item.quantity; });

      const reference = 'DAV-' + Date.now();

      btn.disabled = true;
      btn.textContent = 'Processing...';
      msg.textContent = '';

      try {
        // 1. Create order
        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
          },
          body: JSON.stringify({
            user_id: user ? user.id : null,
            firstname: firstname,
            lastname: lastname,
            phone: phone,
            alt_phone: document.getElementById('alt_phone').value.trim(),
            neighbor_phone: document.getElementById('neighbor_phone').value.trim(),
            address: address,
            town: town,
            lga: lga,
            state: state,
            payment_method: payment,
            payment_reference: reference,
            items: cart,
            total: total
          })
        });

        const orderData = await orderRes.json();
        if (!orderData.ok) {
          throw new Error(orderData.error || 'Could not create order');
        }

        // Save last order locally
        localStorage.setItem('lastOrder', JSON.stringify({
          reference: orderData.order_id,
          total: orderData.total,
          payment_method: payment,
          status: 'Pending'
        }));

        if (payment === 'paystack') {
          // 2. Initialize Paystack
          const email = (user && user.email) ? user.email : (phone + '@davilanco.customer');
          const initRes = await fetch('/api/paystack/initialize', {
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

          const initData = await initRes.json();
          if (!initData.ok || !initData.authorization_url) {
            throw new Error(initData.error || 'Paystack initialization failed');
          }

          // Redirect to Paystack
          window.location.href = initData.authorization_url;
          return;
        }

        // Bank transfer
        localStorage.removeItem('cart');
        msg.className = 'success';
        msg.innerHTML = 'Order placed!<br>Reference: <strong>' + orderData.order_id + '</strong><br>Transfer the exact amount and use this reference as description. Admin will confirm payment.';
        btn.textContent = 'Order Placed';

        setTimeout(function() {
          window.location.href = '/dashboard.html';
        }, 3500);

      } catch (err) {
        msg.className = 'error';
        msg.textContent = err.message || 'Something went wrong';
        btn.disabled = false;
        btn.textContent = 'Place Order';
      }
    }

    renderCheckout();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  })();
}

/* ===== js/pages/admin-api.js ===== */
if (["/admin/api.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from admin/api.html */
(function(){
  var token=localStorage.getItem('token'), storedUser=null;
  try{storedUser=JSON.parse(localStorage.getItem('user')||'null')}catch(e){}
  if(!token||!storedUser){window.location.replace('/login.html?redirect='+encodeURIComponent('/admin/api.html'));return}
  if(storedUser.role!=='admin'){alert('Access denied. Admin only.');window.location.replace('/dashboard.html');return}

  // File list mirrors functions/api/*.js and functions/api/paystack/*.js in the repository.
  // "Risky" routes are explicitly marked and require typing RUN before this console sends a request.
  var apis=[
    {file:'functions/api/ae-callback.js',path:'/api/ae-callback',method:'GET',note:'AliExpress callback handler',risk:true},
    {file:'functions/api/ae-place-order.js',path:'/api/ae-place-order',method:'POST',note:'Places supplier orders; may create external orders',risk:true},
    {file:'functions/api/ae-tracking.js',path:'/api/ae-tracking',method:'POST',note:'AliExpress tracking operations',risk:true},
    {file:'functions/api/ae-webhook.js',path:'/api/ae-webhook',method:'POST',note:'AliExpress webhook handler',risk:true},
    {file:'functions/api/aetest.js',path:'/api/aetest',method:'GET',note:'AliExpress diagnostic endpoint'},
    {file:'functions/api/analytics.js',path:'/api/analytics',method:'GET',note:'GET analytics; POST records an analytics event'},
    {file:'functions/api/confirm-verify.js',path:'/api/confirm-verify',method:'POST',note:'Account verification action',risk:true},
    {file:'functions/api/fix-ae-columns.js',path:'/api/fix-ae-columns',method:'POST',note:'Database/schema maintenance',risk:true},
    {file:'functions/api/fix-messages-table.js',path:'/api/fix-messages-table',method:'POST',note:'Database/schema maintenance',risk:true},
    {file:'functions/api/fix-order-table.js',path:'/api/fix-order-table',method:'POST',note:'Database/schema maintenance',risk:true},
    {file:'functions/api/fix-products-table.js',path:'/api/fix-products-table',method:'POST',note:'Database/schema maintenance',risk:true},
    {file:'functions/api/fix-users-verify.js',path:'/api/fix-users-verify',method:'POST',note:'Database/schema maintenance',risk:true},
    {file:'functions/api/import-aliexpress.js',path:'/api/import-aliexpress',method:'POST',note:'AliExpress product search/import; inspect action before running',risk:true},
    {file:'functions/api/login.js',path:'/api/login',method:'POST',note:'Login endpoint; never submit real passwords here'},
    {file:'functions/api/messages.js',path:'/api/messages',method:'GET',note:'Messages API; POST may send or create messages',risk:true},
    {file:'functions/api/oauth.js',path:'/api/oauth',method:'GET',note:'OAuth flow/callback; may redirect or alter connection state',risk:true},
    {file:'functions/api/orders-update.js',path:'/api/orders-update',method:'POST',note:'Changes order status or details',risk:true},
    {file:'functions/api/orders.js',path:'/api/orders',method:'GET',note:'Orders API; POST creates an order',risk:true},
    {file:'functions/api/paystack/initialize.js',path:'/api/paystack/initialize',method:'POST',note:'Initializes a payment transaction',risk:true},
    {file:'functions/api/paystack/verify.js',path:'/api/paystack/verify',method:'POST',note:'Verifies a payment reference',risk:true},
    {file:'functions/api/products.js',path:'/api/products',method:'GET',note:'Products API; POST may add or update products',risk:true},
    {file:'functions/api/resend-verify.js',path:'/api/resend-verify',method:'POST',note:'May send a verification email/message',risk:true},
    {file:'functions/api/reset-and-seed.js',path:'/api/reset-and-seed',method:'POST',note:'Potentially destructive database reset/seed',risk:true,destructive:true},
    {file:'functions/api/reset-messages.js',path:'/api/reset-messages',method:'POST',note:'Potentially deletes message data',risk:true,destructive:true},
    {file:'functions/api/reset-orders.js',path:'/api/reset-orders',method:'POST',note:'Potentially deletes order data',risk:true,destructive:true},
    {file:'functions/api/reset-users.js',path:'/api/reset-users',method:'POST',note:'Potentially deletes user data',risk:true,destructive:true},
    {file:'functions/api/seed-products.js',path:'/api/seed-products',method:'POST',note:'May create or replace product data',risk:true,destructive:true},
    {file:'functions/api/seller.js',path:'/api/seller',method:'GET',note:'Seller API; POST may change seller data',risk:true},
    {file:'functions/api/setup-db.js',path:'/api/setup-db',method:'POST',note:'Database setup/migration action',risk:true},
    {file:'functions/api/signup.js',path:'/api/signup',method:'POST',note:'Creates an account; use test data only',risk:true},
    {file:'functions/api/upload.js',path:'/api/upload',method:'POST',note:'Uploads/changes files; use test data only',risk:true},
    {file:'functions/api/users.js',path:'/api/users',method:'GET',note:'Users API; POST may change user data',risk:true}
  ];
  var catalog=document.getElementById('catalog'), select=document.getElementById('endpoint');
  var method=document.getElementById('method'), filter=document.getElementById('filter'), status=document.getElementById('status');
  var selected=0;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  document.getElementById('count').textContent='('+apis.length+' routes)';
  select.innerHTML=apis.map(function(a,i){return '<option value="'+i+'">'+esc(a.path)+' — '+esc(a.method)+'</option>'}).join('');
  function choose(i){
    selected=i;select.value=String(i);method.value=apis[i].method;
    document.getElementById('fileHint').textContent=apis[i].file+' · '+apis[i].note+(apis[i].risk?' · Extra caution required':'');
    renderCatalog();
  }
  function renderCatalog(){
    var q=filter.value.trim().toLowerCase();
    var matches=apis.map(function(a,i){return {a:a,i:i}}).filter(function(x){return !q||(x.a.path+' '+x.a.file+' '+x.a.note).toLowerCase().includes(q)});
    catalog.innerHTML=matches.map(function(x){var a=x.a;return '<div class="api-item '+(x.i===selected?'active':'')+'"><div><div class="api-name">'+esc(a.path)+'</div><div class="api-file">'+esc(a.file)+'</div><span class="badge">'+esc(a.method)+' default</span>'+(a.risk?'<span class="badge risk">'+(a.destructive?'DESTRUCTIVE':'LIVE SIDE EFFECTS')+'</span>':'<span class="badge read">LOWER RISK</span>')+'<div class="small muted">'+esc(a.note)+'</div></div><button type="button" data-use="'+x.i+'">Select</button></div>'}).join('')||'<p class="muted">No routes match your search.</p>';
    catalog.querySelectorAll('[data-use]').forEach(function(btn){btn.addEventListener('click',function(){choose(Number(btn.getAttribute('data-use')));document.querySelector('.panel:nth-child(2)').scrollIntoView({behavior:'smooth',block:'start'})})});
  }
  select.addEventListener('change',function(){choose(Number(select.value))});
  filter.addEventListener('input',renderCatalog);
  document.getElementById('clear').addEventListener('click',function(){document.getElementById('meta').textContent='Response cleared.';document.getElementById('output').textContent='';status.textContent='';status.className='status'});
  document.getElementById('run').addEventListener('click',async function(){
    var api=apis[Number(select.value)], verb=method.value, query=document.getElementById('query').value.trim();
    var url=api.path+(query?(query.charAt(0)==='?'?query:'?'+query):'');
    var payload;
    if(verb!=='GET'&&verb!=='HEAD'){
      try{payload=JSON.parse(document.getElementById('body').value||'{}')}catch(e){status.className='status bad';status.textContent='Request body is not valid JSON. Correct it before running.';return}
    }
    if(api.destructive){
      var typed=prompt('WARNING: '+api.path+' may permanently change or delete live store data. To proceed, type RUN exactly. Cancel to stop.');
      if(typed!=='RUN'){status.className='status';status.textContent='Request cancelled; nothing was sent.';return}
    }else if(api.risk||!['GET','HEAD'].includes(verb)){
      if(!confirm('This will send a real '+verb+' request to '+url+' on the LIVE store. It may change data or trigger an external service. Continue?')){status.className='status';status.textContent='Request cancelled; nothing was sent.';return}
    }
    var button=document.getElementById('run'), out=document.getElementById('output'), meta=document.getElementById('meta');
    button.disabled=true;status.className='status';status.textContent='Sending request…';out.textContent='Waiting for response…';
    var started=Date.now();
    try{
      var options={method:verb,headers:{'Accept':'application/json','Authorization':'Bearer '+token,'Cache-Control':'no-store'}};
      if(payload!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload)}
      var response=await fetch(url,options);
      var text=await response.text(), shown=text;
      try{shown=JSON.stringify(JSON.parse(text),null,2)}catch(e){}
      if(shown.length>100000)shown=shown.slice(0,100000)+'\n\n[Response clipped at 100,000 characters]';
      out.textContent=shown||'(empty response body)';
      meta.textContent='HTTP '+response.status+' '+response.statusText+' · '+(Date.now()-started)+' ms · '+url;
      status.className='status '+(response.ok?'good':'bad');
      status.textContent=response.ok?'Request completed. Check the response body for the API-specific result.':'Request returned an HTTP error. Read the response body for details.';
    }catch(e){
      meta.textContent=url;out.textContent=String(e&&e.message||e);status.className='status bad';status.textContent='Network or browser error. The request may not have reached the API.';
    }finally{button.disabled=false}
  });
  choose(0);
})();


  // Make page handlers available to HTML inline event attributes.
  if (typeof esc === 'function') window.esc = esc;
  if (typeof choose === 'function') window.choose = choose;
  if (typeof renderCatalog === 'function') window.renderCatalog = renderCatalog;
  })();
}

/* ===== js/pages/admin-users.js ===== */
if (["/admin/users.html"].includes(window.location.pathname)) {
  (function () {
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
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof filterUsers === "function") window.filterUsers = filterUsers;
  if (typeof loadUsers === "function") window.loadUsers = loadUsers;

  // Make page handlers available to HTML inline event attributes.
  if (typeof toggleTheme === 'function') window.toggleTheme = toggleTheme;
  if (typeof toggleNav === 'function') window.toggleNav = toggleNav;
  if (typeof showToast === 'function') window.showToast = showToast;
  if (typeof loadUsers === 'function') window.loadUsers = loadUsers;
  if (typeof filterUsers === 'function') window.filterUsers = filterUsers;
  if (typeof renderUsers === 'function') window.renderUsers = renderUsers;
  if (typeof toggleOrders === 'function') window.toggleOrders = toggleOrders;
  if (typeof loadUserOrders === 'function') window.loadUserOrders = loadUserOrders;
  if (typeof toggleMessage === 'function') window.toggleMessage = toggleMessage;
  if (typeof sendMessage === 'function') window.sendMessage = sendMessage;
  if (typeof setStatus === 'function') window.setStatus = setStatus;
  if (typeof setRole === 'function') window.setRole = setRole;
  if (typeof deleteUser === 'function') window.deleteUser = deleteUser;
  })();
}

/* ===== js/pages/admin-index.js ===== */
if (["/admin/","/admin/index.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from admin/index.html */
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

  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;

  // Make page handlers available to HTML inline event attributes.
  if (typeof toggleTheme === 'function') window.toggleTheme = toggleTheme;
  if (typeof toggleNav === 'function') window.toggleNav = toggleNav;
  })();
}

/* ===== Additional consolidated page scripts ===== */

/* ===== js/pages/dashboard.js ===== */
if (["/dashboard.html"].includes(window.location.pathname)) {
  (function () {
// ========== AUTH ==========
// The HttpOnly server cookie is authoritative; never trust a role or user ID from localStorage.
let user = {};
async function loadDashboardSession() {
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.user || !data.user.id) {
      throw new Error(data.error || 'Your session has expired. Please sign in again.');
    }
    user = data.user;
    document.documentElement.classList.remove('davilanco-auth-pending');
    localStorage.setItem('user', JSON.stringify(user));
    if (user.role === 'seller' || user.role === 'admin') document.getElementById('sellerLink').classList.remove('hidden');
    if (user.role === 'admin') document.getElementById('adminLink').classList.remove('hidden');
    document.getElementById('nicknameDisplay').textContent = user.nickname || 'User';
    document.getElementById('fullName').textContent = (user.firstname || '') + ' ' + (user.lastname || '');
    document.getElementById('nick').textContent = user.nickname || '–';
    document.getElementById('phone').textContent = user.phone || '–';
    document.getElementById('email').textContent = user.email || '–';
    document.getElementById('role').textContent = user.role || 'customer';
    loadReferralStats();
    loadCartSummary();
    loadOrders();
    loadMessages();
  } catch (error) {
    console.error('[Davilanco dashboard session]', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('/login.html?redirect=' + encodeURIComponent('/dashboard.html'));
  }
}

const savedTheme = localStorage.getItem('theme');
document.documentElement.setAttribute('data-theme', savedTheme || 'dark');
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}
function toggleNav() { document.getElementById('navDrawer').classList.toggle('open'); }
document.getElementById('logoutBtn').addEventListener('click', async function(e) {
  e.preventDefault();
  try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.replace('/login.html');
});
window.addEventListener('scroll', function() {
  document.getElementById('backToTop').style.display = window.scrollY > 300 ? 'block' : 'none';
});

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
  if (!n1 || n1 !== n2) { msg.style.color = '#e74c3c'; msg.textContent = 'New passwords do not match'; return; }
  if (n1.length < 8) { msg.style.color = '#e74c3c'; msg.textContent = 'Password must be at least 8 characters'; return; }
  msg.style.color = '#27ae60'; msg.textContent = 'Password change will be connected to API next.';
}

async function loadReferralStats() {
  const codeEl = document.getElementById('myReferralCode');
  const linkEl = document.getElementById('myReferralLink');
  const countEl = document.getElementById('referralCount');
  const listEl = document.getElementById('referralList');
  const msgEl = document.getElementById('referralMsg');
  try {
    const res = await fetch('/api/referrals');
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load referral information.');
    codeEl.textContent = data.referral_code;
    linkEl.value = data.referral_link;
    countEl.textContent = String(data.referral_count || 0);
    if (!data.referrals || !data.referrals.length) {
      listEl.textContent = 'No referred sign-ups yet. Share your link to get started.';
    } else {
      listEl.innerHTML = '<strong>People who joined:</strong><ul>' + data.referrals.map(function(item) {
        const li = document.createElement('li');
        li.textContent = (item.nickname || 'Customer') + (item.created_at ? ' — ' + item.created_at : '');
        return li.outerHTML;
      }).join('') + '</ul>';
    }
  } catch (err) {
    msgEl.style.color = '#e74c3c';
    msgEl.textContent = err.message || 'Could not load referral information.';
    listEl.textContent = 'Referral information is temporarily unavailable.';
  }
}
async function copyReferralLink() {
  const field = document.getElementById('myReferralLink');
  const msg = document.getElementById('referralMsg');
  try {
    await navigator.clipboard.writeText(field.value);
    msg.style.color = '#27ae60'; msg.textContent = 'Referral link copied.';
  } catch (e) {
    field.focus(); field.select();
    msg.style.color = ''; msg.textContent = 'Select and copy the link above.';
  }
}
async function shareReferralLink() {
  const link = document.getElementById('myReferralLink').value;
  if (navigator.share) {
    try { await navigator.share({ title: 'Join Davilanco', text: 'Create your Davilanco account using my referral link:', url: link }); } catch (e) {}
  } else {
    await copyReferralLink();
  }
}

// ========== CART ==========
function loadCartSummary() {
  const box = document.getElementById('cartCard');
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { cart = []; }
  if (!cart.length) {
    box.innerHTML = '<p>Your cart is empty.</p><a href="/"><button style="margin-top:8px">Continue Shopping</button></a>';
    return;
  }
  let total = 0, html = '';
  for (let i = 0; i < cart.length; i++) {
    const item = cart[i]; total += item.price * item.quantity;
    html += '<div class="order-item">' + escapeText(item.name || 'Item') + ' × ' + item.quantity + ' — ₦' + (item.price * item.quantity).toLocaleString() + '</div>';
  }
  html += '<p style="margin-top:10px"><strong>Total: ₦' + total.toLocaleString() + '</strong></p>';
  html += '<a href="/cart.html"><button style="margin-top:8px">View Cart / Checkout</button></a>';
  box.innerHTML = html;
}
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, function(ch) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]); });
}

// ========== ORDERS ==========
async function loadOrders() {
  const list = document.getElementById('ordersList');
  if (!user.id) { list.innerHTML = '<p style="opacity:0.7">Login to see your orders.</p>'; return; }
  try {
    const res = await fetch('/api/orders?user_id=' + encodeURIComponent(user.id));
    const data = await res.json();
    const orders = data.orders || [];
    if (!orders.length) { list.innerHTML = '<p style="opacity:0.7">No orders yet. <a href="/" style="color:var(--gold)">Shop now</a></p>'; return; }
    let html = '', latestTracked = null;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i], status = (o.status || 'Pending').toLowerCase();
      let badge = 'pending';
      if (status.indexOf('approved') !== -1) badge = 'approved';
      if (status.indexOf('ship') !== -1 || status.indexOf('transit') !== -1) badge = 'shipping';
      if (status.indexOf('deliver') !== -1) badge = 'delivered';
      let itemsText = '';
      if (o.items && o.items.length) itemsText = o.items.map(function(item) { return escapeText(item.product_name || 'Item') + ' × ' + item.quantity; }).join(', ');
      html += '<div class="order-item"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><strong>' + escapeText(o.id || '') + '</strong><span class="status ' + badge + '">' + escapeText(o.status || 'Pending') + '</span></div>';
      html += '<div style="margin-top:6px;font-size:13px;opacity:0.9">Total: ₦' + Number(o.total || 0).toLocaleString() + '<br>Payment: ' + escapeText(o.payment_method || '–') + ' · ' + escapeText(o.payment_status || 'pending') + '<br>Reference: <span style="color:var(--gold)">' + escapeText(o.payment_reference || o.id) + '</span>';
      if (itemsText) html += '<br>Items: ' + itemsText;
      if (o.tracking_number) {
        html += '<br>Tracking: ' + escapeText(o.tracking_number);
        if (o.logistics) html += ' (' + escapeText(o.logistics) + ')';
        if (o.eta) html += ' · ETA: ' + escapeText(o.eta);
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
  } catch (err) { list.innerHTML = '<p style="opacity:0.7">Could not load orders. Please refresh.</p>'; }
}

// ========== MESSAGES ==========
async function loadMessages() {
  const box = document.getElementById('messagesBox');
  if (!user || !user.id) return;
  try {
    const res = await fetch('/api/messages?user_id=' + encodeURIComponent(user.id));
    const data = await res.json(), msgs = data.messages || [];
    if (!msgs.length) { box.innerHTML = '<p style="opacity:0.7">No messages yet.</p>'; return; }
    box.innerHTML = msgs.map(function(m) {
      return '<div style="margin-bottom:6px"><strong>' + (m.sender_role === 'admin' ? 'Admin' : 'You') + ':</strong> ' + escapeText(m.message || '') + '</div>';
    }).join('');
  } catch (e) { box.innerHTML = '<p style="opacity:0.7">Could not load messages.</p>'; }
}
async function sendMessage() {
  const message = document.getElementById('msgInput').value.trim();
  if (!message || !user || !user.id) return;
  try {
    const res = await fetch('/api/messages', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({sender_id:user.id, sender_role:user.role || 'customer', sender_name:user.nickname || 'Customer', receiver_id:null, receiver_role:'admin', message})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    document.getElementById('msgInput').value = ''; loadMessages();
  } catch (err) { alert(err.message || 'Could not send'); }
}

function applySeller() {
  const products = document.getElementById('s_products').value.trim();
  const address = document.getElementById('s_address').value.trim();
  const idnum = document.getElementById('s_idnumber').value.trim();
  const msg = document.getElementById('sellerMsg');
  if (!products || !address || !idnum) { msg.style.color = '#e74c3c'; msg.textContent = 'Please fill all required fields'; return; }
  msg.style.color = '#27ae60'; msg.textContent = 'Application submitted (API connection coming next).';
}

loadDashboardSession();

  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof toggleEdit === "function") window.toggleEdit = toggleEdit;
  if (typeof saveDetails === "function") window.saveDetails = saveDetails;
  if (typeof copyReferralLink === "function") window.copyReferralLink = copyReferralLink;
  if (typeof shareReferralLink === "function") window.shareReferralLink = shareReferralLink;
  if (typeof changePassword === "function") window.changePassword = changePassword;
  if (typeof sendMessage === "function") window.sendMessage = sendMessage;
  if (typeof applySeller === "function") window.applySeller = applySeller;
  })();
}

/* ===== js/pages/seller-index.js ===== */
if (["/seller/index.html"].includes(window.location.pathname)) {
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

    var token = localStorage.getItem('token');
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
    var userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent('/seller/');
    }

    var user = {};
    try { user = JSON.parse(userStr); } catch (e) {
      localStorage.clear();
      window.location.href = '/login.html';
    }

    if (user.role !== 'seller' && user.role !== 'admin') {
      alert('Seller access only. Apply from your dashboard or ask admin to promote you.');
      window.location.href = '/dashboard.html';
    }

    if (user.role === 'admin') {
      document.getElementById('adminLink').style.display = 'block';
    }

    document.getElementById('sellerName').textContent = user.nickname || 'Seller';

    document.getElementById('logoutBtn').addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
    });

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

/* ===== js/pages/admin-orders.js ===== */
if (["/admin/orders.html"].includes(window.location.pathname)) {
  (function () {
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
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof loadOrders === "function") window.loadOrders = loadOrders;
  if (typeof updateOrder === "function") window.updateOrder = updateOrder;
  if (typeof markPaidAndApprove === "function") window.markPaidAndApprove = markPaidAndApprove;

  // Make page handlers available to HTML inline event attributes.
  if (typeof placeOnAe === 'function') window.placeOnAe = placeOnAe;
  if (typeof pullTracking === 'function') window.pullTracking = pullTracking;
  if (typeof selectOrderByIndex === 'function') window.selectOrderByIndex = selectOrderByIndex;
  if (typeof quickConfirmByIndex === 'function') window.quickConfirmByIndex = quickConfirmByIndex;
  if (typeof placeOnAeByIndex === 'function') window.placeOnAeByIndex = placeOnAeByIndex;
  if (typeof pullTrackingByIndex === 'function') window.pullTrackingByIndex = pullTrackingByIndex;
  if (typeof escapeHtml === 'function') window.escapeHtml = escapeHtml;
  if (typeof toggleTheme === 'function') window.toggleTheme = toggleTheme;
  if (typeof toggleNav === 'function') window.toggleNav = toggleNav;
  if (typeof showToast === 'function') window.showToast = showToast;
  if (typeof badgeClass === 'function') window.badgeClass = badgeClass;
  if (typeof selectOrder === 'function') window.selectOrder = selectOrder;
  if (typeof loadOrders === 'function') window.loadOrders = loadOrders;
  if (typeof updateOrder === 'function') window.updateOrder = updateOrder;
  if (typeof markPaidAndApprove === 'function') window.markPaidAndApprove = markPaidAndApprove;
  if (typeof quickConfirm === 'function') window.quickConfirm = quickConfirm;
  })();
}

/* ===== js/pages/admin-messages.js ===== */
if (["/admin/messages.html"].includes(window.location.pathname)) {
  (function () {
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
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof filterUserList === "function") window.filterUserList = filterUserList;
  if (typeof sendAdminReply === "function") window.sendAdminReply = sendAdminReply;
  if (typeof loadThread === "function") window.loadThread = loadThread;
  if (typeof loadAllMessages === "function") window.loadAllMessages = loadAllMessages;

  // Make page handlers available to HTML inline event attributes.
  if (typeof toggleTheme === 'function') window.toggleTheme = toggleTheme;
  if (typeof toggleNav === 'function') window.toggleNav = toggleNav;
  if (typeof showToast === 'function') window.showToast = showToast;
  if (typeof loadUsers === 'function') window.loadUsers = loadUsers;
  if (typeof filterUserList === 'function') window.filterUserList = filterUserList;
  if (typeof renderUserList === 'function') window.renderUserList = renderUserList;
  if (typeof selectUser === 'function') window.selectUser = selectUser;
  if (typeof loadThread === 'function') window.loadThread = loadThread;
  if (typeof escapeHtml === 'function') window.escapeHtml = escapeHtml;
  if (typeof sendAdminReply === 'function') window.sendAdminReply = sendAdminReply;
  if (typeof loadAllMessages === 'function') window.loadAllMessages = loadAllMessages;
  })();
}

/* ===== js/pages/seller-profile.js ===== */
if (["/seller-profile.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from seller-profile.html */
var savedTheme = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', savedTheme || 'dark');
    function toggleTheme() {
      var c = document.documentElement.getAttribute('data-theme');
      var n = c === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', n);
      localStorage.setItem('theme', n);
    }

    var params = new URLSearchParams(window.location.search);
    var sellerId = params.get('id') || '';
    var nickname = params.get('nickname') || '';
    var currentSeller = null;

    var me = null;
    try { me = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { me = null; }

    async function load() {
      var box = document.getElementById('content');
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
        var photo = s.photo || 'https://via.placeholder.com/72?text=' + encodeURIComponent((s.nickname || 'S').charAt(0));

        var html = '';
        html += '<div class="card"><div class="profile-top">';
        html += '<img class="avatar" src="' + photo + '" alt="">';
        html += '<div><h1>' + store + '</h1>';
        html += '<div class="meta">@' + (s.nickname || '') + '<br>';
        if (s.phone) html += 'Phone: ' + s.phone + '<br>';
        if (s.email) html += 'Email: ' + s.email;
        html += '</div></div></div>';
        if (s.bio) html += '<p style="margin-top:12px;font-size:14px">' + s.bio + '</p>';
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
          for (var i = 0; i < products.length; i++) {
            var p = products[i];
            html += '<a class="p-card" href="/product.html?id=' + p.id + '">';
            html += '<img src="' + (p.image || 'https://via.placeholder.com/200?text=No+Image') + '" alt="">';
            html += '<div><strong>' + (p.name || '') + '</strong><br>₦' + Number(p.price || 0).toLocaleString() + '</div>';
            html += '</a>';
          }
          html += '</div>';
        }
        html += '</div>';

        box.innerHTML = html;
        document.title = store + ' – Davilanco';
      } catch (err) {
        box.innerHTML = '<p>Could not load seller.</p><a href="/" style="color:var(--gold)">Back to shop</a>';
      }
    }

    async function sendToSeller() {
      if (!me || !currentSeller) return;
      var text = (document.getElementById('sellerMsg').value || '').trim();
      var status = document.getElementById('msgStatus');
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
        document.getElementById('sellerMsg').value = '';
        status.style.color = '#27ae60';
        status.textContent = 'Message sent';
      } catch (err) {
        status.style.color = '#e74c3c';
        status.textContent = err.message || 'Failed';
      }
    }

    load();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  })();
}

/* ===== js/pages/admin-analytics.js ===== */
if (["/admin/analytics.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from admin/analytics.html */
(function(){
  var status=document.getElementById('status');
  function number(v){return Number(v||0).toLocaleString('en-NG')}
  function escapeText(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  async function load(){
    status.className='status';status.textContent='Loading…';
    try{
      var days=Number(document.getElementById('range').value)||7;
      var response=await fetch('/api/analytics?days='+days,{credentials:'same-origin',cache:'no-store'});
      var data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not load analytics');
      document.getElementById('todayViews').textContent=number(data.today.page_views);
      document.getElementById('todayVisitors').textContent=number(data.today.visitors);
      document.getElementById('todayProducts').textContent=number(data.today.product_views);
      var total=(data.daily||[]).reduce(function(sum,d){return sum+Number(d.page_views||0)},0);
      document.getElementById('rangeViews').textContent=number(total);
      var rows=data.daily||[];
      var max=Math.max(1,...rows.map(function(d){return Number(d.page_views||0)}));
      document.getElementById('chart').innerHTML=rows.length?rows.map(function(d){
        var date=String(d.event_date||'').slice(5);
        var count=Number(d.page_views||0);
        var height=Math.max(3,Math.round(count/max*112));
        return '<div class="bar-col" title="'+escapeText(d.event_date)+': '+number(count)+' page views"><div class="bar-num">'+number(count)+'</div><div class="bar" style="height:'+height+'px"></div><div class="bar-date">'+escapeText(date)+'</div></div>';
      }).join(''):'<p class="status">No visits recorded yet. Visit the public store to create the first test entry.</p>';
      document.getElementById('popular').innerHTML=(data.popular_pages||[]).length?(data.popular_pages||[]).map(function(p){return '<tr><td>'+escapeText(p.path)+'</td><td>'+number(p.views)+'</td></tr>'}).join(''):'<tr><td colspan="2">No page-view data yet.</td></tr>';
      status.textContent='Updated just now';
    }catch(e){
      status.className='status error';
      status.textContent=e.message||'Could not load analytics';
      if(/Admin|sign-in|access required/i.test(status.textContent)){status.textContent='Please sign in again with an admin account.'}
    }
  }
  document.getElementById('refresh').addEventListener('click',load);
  document.getElementById('range').addEventListener('change',load);
  load();
})();


  // Make page handlers available to HTML inline event attributes.
  if (typeof number === 'function') window.number = number;
  if (typeof escapeText === 'function') window.escapeText = escapeText;
  if (typeof load === 'function') window.load = load;
  })();
}

/* ===== js/pages/admin-products.js ===== */
if (["/admin/products.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from admin/products.html */
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

    function showToast(text) {
      var t = document.getElementById('toast');
      t.textContent = text || 'Saved';
      t.style.display = 'block';
      setTimeout(function() { t.style.display = 'none'; }, 1800);
    }

    var adminUploadedUrl = '';

async function onAdminFileSelected(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type || file.type.indexOf('image/') !== 0) {
    alert('Choose an image file');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    alert('Max 3MB');
    return;
  }

  var prev = document.getElementById('adminImgPreview');
  prev.src = URL.createObjectURL(file);
  prev.style.display = 'block';

  var msg = document.getElementById('addMsg');
  msg.style.color = 'var(--text)';
  msg.textContent = 'Uploading image...';

  try {
    var form = new FormData();
    form.append('file', file);
    var res = await fetch('/api/upload', { method: 'POST', body: form });
    var data = await res.json();
    if (!data.ok || !data.url) throw new Error(data.error || 'Upload failed');
    adminUploadedUrl = data.url;
    document.getElementById('p_image').value = data.url;
    msg.style.color = '#27ae60';
    msg.textContent = 'Image uploaded';
  } catch (err) {
    adminUploadedUrl = '';
    msg.style.color = '#e74c3c';
    msg.textContent = err.message || 'Upload failed';
  }
    }
    
    async function addProduct() {
      var msg = document.getElementById('addMsg');
      var name = document.getElementById('p_name').value.trim();
      var price = Number(document.getElementById('p_price').value);
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
            old_price: Number(document.getElementById('p_old_price').value) || 0,
            category: document.getElementById('p_category').value.trim() || 'others',
            stock: Number(document.getElementById('p_stock').value) || 0,
            image: document.getElementById('p_image').value.trim() || adminUploadedUrl || '',
			  
			  
            description: document.getElementById('p_desc').value.trim(),
            status: 'approved'
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        msg.style.color = '#27ae60';
        msg.textContent = 'Product added';
        document.getElementById('p_name').value = '';
        document.getElementById('p_price').value = '';
        document.getElementById('p_desc').value = '';
        document.getElementById('p_image').value = '';
        document.getElementById('p_image_file').value = '';
        adminUploadedUrl = '';
        document.getElementById('adminImgPreview').style.display = 'none';
		  showToast('Product added');
        loadProducts();
      } catch (err) {
        msg.style.color = '#e74c3c';
        msg.textContent = err.message || 'Failed';
      }
    }

    async function importProduct() {
      var url = document.getElementById('importUrl').value.trim();
      var msg = document.getElementById('importMsg');
      if (!url) {
        alert('Paste a product URL first');
        return;
      }
      if (msg) {
        msg.style.color = '#C4FF61';
        msg.textContent = 'Importing from AliExpress…';
      }
      try {
        var res = await fetch('/api/import-aliexpress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url, status: 'pending' })
        });
        var data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Import failed');
        if (msg) {
          msg.style.color = '#27ae60';
          msg.textContent = 'Imported: ' + (data.product && data.product.name ? data.product.name : data.id);
        }
        document.getElementById('importUrl').value = '';
        showToast('Product imported');
        loadProducts();
      } catch (err) {
        if (msg) {
          msg.style.color = '#e74c3c';
          msg.textContent = err.message || 'Import failed';
        } else {
          alert(err.message || 'Import failed');
        }
      }
	  }

	  function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}
function safeImageUrl(value) {
  var url = String(value || '');
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : 'https://via.placeholder.com/80?text=No+Img';
}

async function testAeApi() {
  var result = document.getElementById('aeApiTestResult');
  var input = document.getElementById('searchKw');
  var keyword = input.value.trim() || 'phone case';
  result.style.color = 'var(--text)';
  result.textContent = 'Testing the AliExpress search API with "' + keyword + '"…';
  try {
    var res = await fetch('/api/import-aliexpress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ae_search', keywords: keyword })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      throw new Error('HTTP ' + res.status + ': ' + (data.error || 'The API request failed.'));
    }
    var count = Array.isArray(data.items) ? data.items.length : 0;
    result.style.color = count ? '#27ae60' : '#f39c12';
    result.textContent = count
      ? 'API connection successful. AliExpress returned ' + count + ' product(s). Try Search to view them.'
      : 'The API endpoint responded successfully, but returned 0 usable products. This usually points to AliExpress permissions, response format, or product filtering—not admin sign-in.';
  } catch (err) {
    result.style.color = '#e74c3c';
    result.textContent = 'API test failed: ' + (err.message || 'Unknown error') + ' If it says authentication required, sign out of the admin panel and sign in again.';
  }
}

async function searchAe() {
  var q = document.getElementById('searchKw').value.trim();
  var box = document.getElementById('searchResults');
  if (!q) return alert('Enter a keyword');
  box.innerHTML = '<p>Searching AliExpress…</p>';
  try {
    var res = await fetch('/api/import-aliexpress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ae_search', keywords: q })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      throw new Error(data.error || ('Search failed (HTTP ' + res.status + ').'));
    }
    var items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      box.innerHTML = '<p style="color:#e74c3c">AliExpress returned no products for this search. Try another keyword. If this happens for every search, the AliExpress API credentials or product-search permission may need checking.</p>';
      return;
    }
    box.innerHTML = items.map(function (it) {
      return '<label style="display:flex;gap:8px;align-items:center;margin:8px 0">'
        + '<input type="checkbox" class="aePick" value="' + escapeHtml(it.product_id) + '">'
        + '<img src="' + safeImageUrl(it.image) + '" width="48" height="48" style="object-fit:cover">'
        + '<span>' + escapeHtml(String(it.title || 'Untitled product').slice(0, 100)) + ' — ₦' + Number(it.price_ngn || 0).toLocaleString() + '</span></label>';
    }).join('') + '<button type="button" onclick="bulkImportAe()">Import selected</button>';
  } catch (err) {
    box.innerHTML = '<p style="color:#e74c3c">' + escapeHtml(err.message || 'AliExpress search failed. Please try again.') + '</p>';
  }
}

async function bulkImportAe() {
  var ids = Array.from(document.querySelectorAll('.aePick:checked')).map(function (el) { return el.value; });
  if (!ids.length) return alert('Select at least one');
  var res = await fetch('/api/import-aliexpress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ae_bulk_import', product_ids: ids, status: 'pending' })
  });
  var data = await res.json();
  alert(JSON.stringify(data.results || data, null, 2));
  loadProducts();
	  }

    async function loadProducts() {
      var box = document.getElementById('productsList');
      box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
      try {
        var filter = document.getElementById('statusFilter').value;
        var url = '/api/products?all=1';
        if (filter !== 'all') url += '&status=' + encodeURIComponent(filter);

        var res = await fetch(url);
        var data = await res.json();
        var products = Array.isArray(data) ? data : (data.results || []);

        if (!products.length) {
          box.innerHTML = '<p style="opacity:0.7">No products found.</p>';
          return;
        }

        var html = '';
        for (var i = 0; i < products.length; i++) {
          var p = products[i];
          var id = p.id || '';
          var status = ['approved', 'pending', 'rejected'].includes(p.status) ? p.status : 'pending';
          var img = safeImageUrl(p.image);

          html += '<div class="product-card">';
          html += '<img src="' + img + '" alt="" onerror="this.src=\'https://via.placeholder.com/80?text=No+Img\'">';
          html += '<div class="product-info">';
          html += '<strong>' + escapeHtml(p.name || 'Unnamed') + '</strong> ';
          html += '<span class="badge ' + status + '">' + status + '</span><br>';
          html += '₦' + Number(p.price || 0).toLocaleString();
          if (p.old_price && Number(p.old_price) > 0) {
            html += ' <s style="opacity:0.6">₦' + Number(p.old_price).toLocaleString() + '</s>';
          }
          html += '<br>Stock: ' + (p.stock != null ? p.stock : 0);
          html += ' · ' + escapeHtml(p.category || '–');
          html += '</div>';
          html += '<div style="width:100%">';
          html += '<button type="button" class="secondary" onclick="toggleEdit(\'' + id + '\')">Edit</button>';
          if (status === 'pending') {
            html += '<button type="button" class="success" onclick="setStatus(\'' + id + '\',\'approved\')">Approve</button>';
            html += '<button type="button" class="danger" onclick="setStatus(\'' + id + '\',\'rejected\')">Reject</button>';
          }
          if (status === 'approved') {
            html += '<button type="button" class="secondary" onclick="setStatus(\'' + id + '\',\'pending\')">Unpublish</button>';
          }
          html += '<button type="button" class="danger" onclick="deleteProduct(\'' + id + '\')">Delete</button>';
          html += '</div>';

          html += '<div class="edit-panel" id="edit-' + id + '">';
          html += '<input type="text" id="e_name_' + id + '" value="' + escapeHtml(p.name || '') + '" placeholder="Name">';
          html += '<div class="row2">';
          html += '<input type="number" id="e_price_' + id + '" value="' + (p.price || 0) + '" placeholder="Price">';
          html += '<input type="number" id="e_stock_' + id + '" value="' + (p.stock != null ? p.stock : 0) + '" placeholder="Stock">';
          html += '</div>';
          html += '<div class="row2">';
          html += '<input type="number" id="e_old_' + id + '" value="' + (p.old_price || 0) + '" placeholder="Old price">';
          html += '<input type="text" id="e_cat_' + id + '" value="' + escapeHtml(p.category || '') + '" placeholder="Category">';
          html += '</div>';
          html += '<input type="text" id="e_img_' + id + '" value="' + escapeHtml(p.image || '') + '" placeholder="Image URL">';
          html += '<textarea id="e_desc_' + id + '" placeholder="Description">' + escapeHtml(p.description || '') + '</textarea>';
          html += '<select id="e_status_' + id + '">';
          html += '<option value="approved"' + (status === 'approved' ? ' selected' : '') + '>Approved</option>';
          html += '<option value="pending"' + (status === 'pending' ? ' selected' : '') + '>Pending</option>';
          html += '<option value="rejected"' + (status === 'rejected' ? ' selected' : '') + '>Rejected</option>';
          html += '</select>';
          html += '<button type="button" onclick="saveProduct(\'' + id + '\')">Save Changes</button>';
          html += '</div>';

          html += '</div>';
        }
        box.innerHTML = html;
      } catch (err) {
        box.innerHTML = '<p style="opacity:0.7">Could not load products.</p>';
      }
    }

    function toggleEdit(id) {
      var el = document.getElementById('edit-' + id);
      if (el) el.classList.toggle('open');
    }

    async function saveProduct(id) {
      try {
        var res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: id,
            name: document.getElementById('e_name_' + id).value.trim(),
            price: Number(document.getElementById('e_price_' + id).value),
            stock: Number(document.getElementById('e_stock_' + id).value),
            old_price: Number(document.getElementById('e_old_' + id).value) || 0,
            category: document.getElementById('e_cat_' + id).value.trim(),
            image: document.getElementById('e_img_' + id).value.trim(),
            description: document.getElementById('e_desc_' + id).value.trim(),
            status: document.getElementById('e_status_' + id).value
          })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast('Product updated');
        loadProducts();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    async function setStatus(id, status) {
      try {
        var res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_status', id: id, status: status })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast('Status: ' + status);
        loadProducts();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    async function deleteProduct(id) {
      if (!confirm('Delete this product?')) return;
      try {
        var res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: id })
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed');
        showToast('Product deleted');
        loadProducts();
      } catch (err) {
        alert(err.message || 'Failed');
      }
    }

    loadProducts();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  if (typeof onAdminFileSelected === "function") window.onAdminFileSelected = onAdminFileSelected;
  if (typeof addProduct === "function") window.addProduct = addProduct;
  if (typeof importProduct === "function") window.importProduct = importProduct;
  if (typeof searchAe === "function") window.searchAe = searchAe;
  if (typeof testAeApi === "function") window.testAeApi = testAeApi;
  if (typeof loadProducts === "function") window.loadProducts = loadProducts;

  // Make page handlers available to HTML inline event attributes.
  if (typeof toggleTheme === 'function') window.toggleTheme = toggleTheme;
  if (typeof toggleNav === 'function') window.toggleNav = toggleNav;
  if (typeof showToast === 'function') window.showToast = showToast;
  if (typeof onAdminFileSelected === 'function') window.onAdminFileSelected = onAdminFileSelected;
  if (typeof addProduct === 'function') window.addProduct = addProduct;
  if (typeof importProduct === 'function') window.importProduct = importProduct;
  if (typeof escapeHtml === 'function') window.escapeHtml = escapeHtml;
  if (typeof safeImageUrl === 'function') window.safeImageUrl = safeImageUrl;
  if (typeof testAeApi === 'function') window.testAeApi = testAeApi;
  if (typeof searchAe === 'function') window.searchAe = searchAe;
  if (typeof bulkImportAe === 'function') window.bulkImportAe = bulkImportAe;
  if (typeof loadProducts === 'function') window.loadProducts = loadProducts;
  if (typeof toggleEdit === 'function') window.toggleEdit = toggleEdit;
  if (typeof saveProduct === 'function') window.saveProduct = saveProduct;
  if (typeof setStatus === 'function') window.setStatus = setStatus;
  if (typeof deleteProduct === 'function') window.deleteProduct = deleteProduct;
  })();
}

/* ===== js/pages/payment-success.js ===== */
if (["/payment-success.html"].includes(window.location.pathname)) {
  (function () {
/* Extracted script 1 from payment-success.html */
const savedTheme = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');

    async function verify() {
      const title = document.getElementById('title');
      const message = document.getElementById('message');
      const refEl = document.getElementById('ref');

      if (!reference) {
        title.textContent = 'No payment reference';
        message.className = 'error';
        message.textContent = 'We could not find a payment reference.';
        return;
      }

      refEl.textContent = 'Ref: ' + reference;

      try {
        const res = await fetch('/api/paystack/verify?reference=' + encodeURIComponent(reference));
        const data = await res.json();

        if (data.ok && data.paid) {
          title.textContent = 'Payment Successful';
          message.className = 'success';
          message.textContent = 'Your order has been paid. Thank you!';
          localStorage.removeItem('cart');
        } else {
          title.textContent = 'Payment Not Completed';
          message.className = 'error';
          message.textContent = data.error || 'Payment was not successful. You can try again from checkout.';
        }
      } catch (e) {
        title.textContent = 'Verification Error';
        message.className = 'error';
        message.textContent = 'Could not verify payment. Contact support with your reference.';
      }
    }

    verify();

  })();
}

/* ===== js/pages/categories.js ===== */
if (["/categories.html"].includes(window.location.pathname)) {
  (function () {
const categoryItems=[{key:'fashion',name:'Fashion',icon:'👕',description:'Clothing, shoes and accessories'},{key:'electronics',name:'Electronics',icon:'📱',description:'Phones, gadgets and accessories'},{key:'home',name:'Home',icon:'🏠',description:'Home, kitchen and living'},{key:'beauty',name:'Beauty',icon:'✨',description:'Beauty and personal care'},{key:'others',name:'Others',icon:'🛍️',description:'More products to discover'}];
const theme=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',theme);
function toggleTheme(){const n=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);localStorage.setItem('theme',n)}
const search=document.getElementById('searchBar');search.addEventListener('keydown',e=>{if(e.key==='Enter'&&search.value.trim())location.href='/?q='+encodeURIComponent(search.value.trim())});
(async function(){const grid=document.getElementById('categoryGrid');try{const r=await fetch('/api/products');if(!r.ok)throw new Error('Products unavailable');const d=await r.json();const products=Array.isArray(d)?d:(d.results||[]);grid.innerHTML=categoryItems.map(c=>{const count=products.filter(p=>(p.category||'').toLowerCase()===c.key).length;return '<a class="category-card" href="/category.html?cat='+encodeURIComponent(c.key)+'"><span class="category-icon">'+c.icon+'</span><div><h2>'+c.name+'</h2><p>'+c.description+'</p><div class="count">'+count+' product'+(count===1?'':'s')+'</div></div></a>'}).join('')}catch(e){grid.innerHTML=categoryItems.map(c=>'<a class="category-card" href="/category.html?cat='+c.key+'"><span class="category-icon">'+c.icon+'</span><div><h2>'+c.name+'</h2><p>'+c.description+'</p><div class="count">Browse category →</div></div></a>').join('')}})();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  })();
}

/* ===== js/pages/category.js ===== */
if (["/category.html"].includes(window.location.pathname)) {
  (function () {
const categoryNames={fashion:'Fashion',electronics:'Electronics',home:'Home',beauty:'Beauty',others:'Others'};
const params=new URLSearchParams(location.search);const category=(params.get('cat')||'others').toLowerCase();const title=categoryNames[category]||'Other products';document.title=title+' | Davilanco';document.getElementById('categoryTitle').textContent=title;document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'dark');
function toggleTheme(){const n=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);localStorage.setItem('theme',n)}
let products=[];const grid=document.getElementById('productsGrid');const count=document.getElementById('productCount');
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){const q=document.getElementById('searchBar').value.trim().toLowerCase();let rows=products.filter(p=>(p.name||'').toLowerCase().includes(q));const sort=document.getElementById('sortProducts').value;if(sort==='price-low')rows.sort((a,b)=>Number(a.price)-Number(b.price));if(sort==='price-high')rows.sort((a,b)=>Number(b.price)-Number(a.price));if(sort==='name')rows.sort((a,b)=>(a.name||'').localeCompare(b.name||''));count.textContent=rows.length+' product'+(rows.length===1?'':'s');if(!rows.length){grid.innerHTML='<div class="state-box"><h3>No products found</h3><p>There are currently no products in this category.</p><a href="/categories.html">Browse other categories</a></div>';return}grid.innerHTML=rows.map(p=>'<article class="product-card"><a href="/product.html?id='+encodeURIComponent(p.id)+'"><img src="'+esc(p.image||'https://via.placeholder.com/400?text=No+Image')+'" alt="'+esc(p.name||'Product')+'" loading="lazy"></a><div class="product-info"><a class="product-name" href="/product.html?id='+encodeURIComponent(p.id)+'">'+esc(p.name||'Product')+'</a><div class="product-price">₦'+Number(p.price||0).toLocaleString('en-NG')+'</div><button class="add-btn" data-id="'+esc(p.id)+'">Add to Cart</button></div></article>').join('')}
grid.addEventListener('click',e=>{const b=e.target.closest('.add-btn');if(!b)return;const p=products.find(x=>String(x.id)===b.dataset.id);if(!p)return;let cart=[];try{cart=JSON.parse(localStorage.getItem('cart')||'[]')}catch{}const old=cart.find(x=>String(x.id)===String(p.id));if(old)old.quantity=(Number(old.quantity)||1)+1;else cart.push({id:p.id,name:p.name,price:Number(p.price)||0,image:p.image||'',quantity:1});localStorage.setItem('cart',JSON.stringify(cart));b.textContent='Added ✓';setTimeout(()=>b.textContent='Add to Cart',1200)});
document.getElementById('searchBar').addEventListener('input',render);document.getElementById('sortProducts').addEventListener('change',render);
(async()=>{try{const r=await fetch('/api/products');if(!r.ok)throw new Error();const d=await r.json();const allProducts=Array.isArray(d)?d:(d.results||[]);const primaryCategories=['fashion','electronics','home','beauty'];products=category==='others'?allProducts.filter(p=>!primaryCategories.includes(String(p.category||'').trim().toLowerCase())):allProducts.filter(p=>String(p.category||'').trim().toLowerCase()===category);render()}catch(e){grid.innerHTML='<div class="state-box">Could not load products. Please refresh.</div>';count.textContent='Unavailable'}})();
  if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
  })();
}

