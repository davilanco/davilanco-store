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