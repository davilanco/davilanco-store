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