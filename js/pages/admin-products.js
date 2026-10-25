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
      window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/products.html');
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