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