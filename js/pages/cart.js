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