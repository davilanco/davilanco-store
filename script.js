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
  document.addEventListener('DOMContentLoaded', () => { window.toggleNav = sharedToggleNav; });
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
        const filtered = allProducts.filter(function(p) {
          return (p.category || '').toLowerCase() === cat.toLowerCase();
        });
        renderProducts(filtered);
        document.getElementById('productCount').textContent = filtered.length + ' product' + (filtered.length !== 1 ? 's' : '');
      }
    });

    // Start
    updateCartCount();
    loadProducts();
})();

/* ===== js/pages/cart.js ===== */
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
})();

/* ===== js/pages/oauth.js ===== */
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
})();

/* ===== js/pages/login.js ===== */
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
})();

/* ===== js/pages/verify.js ===== */
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
})();

/* ===== js/pages/signup.js ===== */
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

})();

/* ===== js/pages/product.js ===== */
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
})();

/* ===== js/pages/checkout.js ===== */
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
})();

/* ===== js/pages/admin-api.js ===== */
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
})();

/* ===== js/pages/admin-users.js ===== */
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
})();

/* ===== js/pages/admin-index.js ===== */
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

    var token = localStorage.getItem('token');
    var userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/');
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
})();
