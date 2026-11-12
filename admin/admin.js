/* Davilanco Admin — isolated page bundle. Session cookie is the only authority. */
(function () {
  'use strict';
  var html = document.documentElement;
  var path = window.location.pathname;
  var loginUrl = '/login.html?redirect=' + encodeURIComponent(path + window.location.search);
  
  function hidePrivateContent() { html.classList.add('dvl-admin-auth-pending'); }
  function showPrivateContent() { html.classList.remove('dvl-admin-auth-pending'); }
  hidePrivateContent();

  function setMenuExpanded(open) {
    document.querySelectorAll('[aria-controls="navDrawer"], [onclick*="toggleNav"]').forEach(function (button) {
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      button.classList.toggle('active', open);
    });
  }

  window.toggleNav = function () {
    var drawer = document.getElementById('navDrawer');
    if (!drawer) return;
    var open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    setMenuExpanded(open);
  };

  window.toggleTheme = function () {
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (_) {}
  };

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      var drawer = document.getElementById('navDrawer');
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        setMenuExpanded(false);
      }
    }
  });

  document.addEventListener('click', async function (event) {
    var link = event.target.closest && event.target.closest('#logoutBtn');
    if (!link) return;
    event.preventDefault();
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }); } catch (_) {}
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
    window.location.replace('/login.html');
  }, true);

  fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } })
    .then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || !data.ok || !data.user || !data.user.id) throw new Error('LOGIN_REQUIRED');
        if (data.user.role !== 'admin') throw new Error('ADMIN_REQUIRED');
        window.dvlAdminUser = data.user;
        try { localStorage.setItem('user', JSON.stringify(data.user)); } catch (_) {}
        return data.user;
      });
    })
    .then(function () {
      document.querySelectorAll('a[href="/dashboard.html"], a[href="/seller/"]').forEach(function (link) {
        link.hidden = false;
        link.classList.remove('hidden');
      });
      html.setAttribute('data-theme', (function () { try { return localStorage.getItem('theme') || 'dark'; } catch (_) { return 'dark'; } })());
      showPrivateContent();
      runAdminPage();
    })
    .catch(function (error) {
      if (error && error.message === 'ADMIN_REQUIRED') {
        window.location.replace('/dashboard.html');
        return;
      }
      window.location.replace(loginUrl);
    });

  function runAdminPage() {
    var esc = window.davilancoEsc || function(v){return String(v);};
    var adminUser = window.dvlAdminUser || {};

    function showToast(text) {
      var t = document.getElementById('toast');
      if(!t) return;
      t.textContent = text || 'Saved';
      t.style.display = 'block';
      setTimeout(function() { t.style.display = 'none'; }, 1800);
    }

    /* ===== API Console ===== */
    if (["/admin/api.html"].includes(path)) {
      (function () {
        var apis = [
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
        function escStr(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
        document.getElementById('count').textContent='('+apis.length+' routes)';
        select.innerHTML=apis.map(function(a,i){return '<option value="'+i+'">'+escStr(a.path)+' — '+escStr(a.method)+'</option>'}).join('');
        
        function choose(i){
          selected=i;select.value=String(i);method.value=apis[i].method;
          document.getElementById('fileHint').textContent=apis[i].file+' · '+apis[i].note+(apis[i].risk?' · Extra caution required':'');
          renderCatalog();
        }
        function renderCatalog(){
          var q=filter.value.trim().toLowerCase();
          var matches=apis.map(function(a,i){return {a:a,i:i}}).filter(function(x){return !q||(x.a.path+' '+x.a.file+' '+x.a.note).toLowerCase().includes(q)});
          catalog.innerHTML=matches.map(function(x){var a=x.a;return '<div class="api-item '+(x.i===selected?'active':'')+'"><div><div class="api-name">'+escStr(a.path)+'</div><div class="api-file">'+escStr(a.file)+'</div><span class="badge">'+escStr(a.method)+' default</span>'+(a.risk?'<span class="badge risk">'+(a.destructive?'DESTRUCTIVE':'LIVE SIDE EFFECTS')+'</span>':'<span class="badge read">LOWER RISK</span>')+'<div class="small muted">'+escStr(a.note)+'</div></div><button type="button" data-use="'+x.i+'">Select</button></div>'}).join('')||'<p class="muted">No routes match your search.</p>';
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
            var options={method:verb,headers:{'Accept':'application/json','Cache-Control':'no-store'}};
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
    }

    /* ===== Admin Users ===== */
    if (["/admin/users.html"].includes(path)) {
      (function () {
        var allUsers = [];
        function renderUsers(users) {
          var box = document.getElementById('usersList');
          if (!users.length) { box.innerHTML = '<p style="opacity:0.7">No users found.</p>'; return; }
          var html = '';
          for (var i = 0; i < users.length; i++) {
            var u = users[i];
            var id = esc(u.id || '');
            var role = esc(u.role || 'customer');
            var status = esc(u.status || 'active');
            var verified = Number(u.verified) === 1;
            html += '<div class="user-card" data-id="' + id + '">';
            html += '<div class="user-top">';
            html += '<div><div class="user-name">' + esc(u.firstname || '') + ' ' + esc(u.lastname || '') + '</div>';
            html += '<div style="font-size:13px;opacity:0.8">@' + esc(u.nickname || '') + '</div></div>';
            html += '<div>';
            html += '<span class="badge role-' + role + '">' + role + '</span>';
            html += '<span class="badge status-' + status + '">' + status + '</span>';
            html += '<span class="badge ' + (verified ? 'verified' : 'unverified') + '">' + (verified ? 'verified' : 'unverified') + '</span>';
            html += '</div></div>';
            html += '<div class="user-meta">Email: ' + esc(u.email || '–') + '<br>Phone: ' + esc(u.phone || '–') + '<br>Joined: ' + esc(u.created_at || '–') + '</div>';
            html += '<div class="actions">';
            html += '<button type="button" data-action="orders" data-id="' + id + '">Orders</button>';
            html += '<button type="button" class="secondary" data-action="message" data-id="' + id + '">Message</button>';
            if (status === 'active') html += '<button type="button" class="secondary" data-action="suspend" data-id="' + id + '">Suspend</button>';
            else html += '<button type="button" class="success" data-action="activate" data-id="' + id + '">Reactivate</button>';
            if (role === 'customer') html += '<button type="button" class="secondary" data-action="make-seller" data-id="' + id + '">Make Seller</button>';
            else if (role === 'seller') html += '<button type="button" class="secondary" data-action="make-customer" data-id="' + id + '">Make Customer</button>';
            if (role !== 'admin') html += '<button type="button" class="danger" data-action="delete" data-id="' + id + '" data-nick="' + esc(u.nickname || '') + '">Delete</button>';
            html += '</div>';
            html += '<div class="orders-box" id="orders-' + id + '"></div>';
            html += '<div class="msg-box" id="msg-' + id + '">';
            html += '<textarea id="msgText-' + id + '" placeholder="Type message to ' + esc(u.nickname || 'user') + '..."></textarea>';
            html += '<button type="button" data-action="send-msg" data-id="' + id + '">Send Message</button>';
            html += '</div></div>';
          }
          box.innerHTML = html;
          box.querySelectorAll('button[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var id = btn.getAttribute('data-id'), act = btn.getAttribute('data-action');
              if (act === 'orders') toggleOrders(id);
              else if (act === 'message') toggleMessage(id);
              else if (act === 'suspend') setStatus(id, 'suspended');
              else if (act === 'activate') setStatus(id, 'active');
              else if (act === 'make-seller') setRole(id, 'seller');
              else if (act === 'make-customer') setRole(id, 'customer');
              else if (act === 'delete') deleteUser(id, btn.getAttribute('data-nick'));
              else if (act === 'send-msg') sendMessage(id);
            });
          });
        }
        async function loadUsers() {
          var box = document.getElementById('usersList');
          box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
          try {
            var res = await fetch('/api/users');
            var data = await res.json();
            allUsers = data.users || [];
            renderUsers(allUsers);
          } catch (err) { box.innerHTML = '<p style="opacity:0.7">Could not load users.</p>'; }
        }
        function filterUsers() {
          var q = (document.getElementById('searchBox').value || '').toLowerCase().trim();
          var role = document.getElementById('roleFilter').value;
          var filtered = allUsers.filter(function(u) {
            var matchRole = role === 'all' || (u.role || '') === role;
            if (!matchRole) return false;
            if (!q) return true;
            return [u.firstname, u.lastname, u.nickname, u.email, u.phone, u.role].join(' ').toLowerCase().indexOf(q) !== -1;
          });
          renderUsers(filtered);
        }
        function toggleOrders(userId) {
          var el = document.getElementById('orders-' + userId);
          if (!el) return;
          if (el.classList.contains('open')) { el.classList.remove('open'); return; }
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
            if (!orders.length) { el.innerHTML = '<p style="opacity:0.7">No orders for this user.</p>'; return; }
            var html = '';
            orders.forEach(function(o) {
              html += '<div class="order-line"><strong>' + esc(o.id || '') + '</strong> · ' + esc(o.status || 'Pending');
              html += '<br>₦' + Number(o.total || 0).toLocaleString() + ' · ' + esc(o.payment_method || '') + ' · ' + esc(o.payment_status || 'pending');
              if (o.payment_reference) html += '<br>Ref: ' + esc(o.payment_reference);
              html += '</div>';
            });
            html += '<a href="/admin/orders.html" style="color:var(--gold);font-size:13px">Open Orders panel →</a>';
            el.innerHTML = html;
          } catch (err) { el.innerHTML = '<p style="opacity:0.7">Could not load orders.</p>'; }
        }
        function toggleMessage(userId) {
          var el = document.getElementById('msg-' + userId);
          if (el) el.classList.toggle('open');
        }
        async function sendMessage(userId) {
          var textEl = document.getElementById('msgText-' + userId);
          var text = (textEl && textEl.value || '').trim();
          if (!text) { alert('Type a message first'); return; }
          if (!adminUser || !adminUser.id) return;
          try {
            var res = await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sender_id: adminUser.id, sender_role: 'admin', sender_name: 'Admin', receiver_id: userId, receiver_role: 'customer', message: text })
            });
            var data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            textEl.value = '';
            showToast('Message sent');
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function setStatus(userId, status) {
          try {
            var res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, status: status }) });
            var data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            showToast(status === 'suspended' ? 'User suspended' : 'User reactivated');
            loadUsers();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function setRole(userId, role) {
          try {
            var res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, role: role }) });
            var data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            showToast('Role updated to ' + role);
            loadUsers();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function deleteUser(userId, nickname) {
          if (!confirm('Delete user @' + nickname + '? This cannot be undone.')) return;
          try {
            var res = await fetch('/api/users?id=' + encodeURIComponent(userId), { method: 'DELETE' });
            var data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            showToast('User deleted');
            loadUsers();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        window.filterUsers = filterUsers;
        window.loadUsers = loadUsers;
        loadUsers();
      })();
    }

    /* ===== Admin Orders ===== */
    if (["/admin/orders.html"].includes(path)) {
      (function () {
        var badgeClass = function(status) {
          var s = (status || '').toLowerCase();
          if (s.indexOf('approved') !== -1) return 'approved';
          if (s.indexOf('ship') !== -1 || s.indexOf('transit') !== -1) return 'shipping';
          if (s.indexOf('deliver') !== -1) return 'delivered';
          return 'pending';
        };
        async function loadOrders() {
          var box = document.getElementById('ordersBox');
          box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
          try {
            var res = await fetch('/api/orders?all=1');
            var data = await res.json();
            var orders = data.orders || [];
            window.adminOrders = orders;
            if (!orders.length) { box.innerHTML = '<p style="opacity:0.7">No orders yet.</p>'; return; }
            var html = '';
            for (var i = 0; i < orders.length; i++) {
              var o = orders[i];
              var itemsText = '';
              if (o.items && o.items.length) {
                itemsText = o.items.map(function(it){ return esc(it.product_name || 'Item') + ' x' + esc(it.quantity); }).join(', ');
              }
              html += '<div class="order-card">';
              html += '<div class="order-top"><strong>' + esc(o.id || '') + '</strong><span class="status ' + badgeClass(o.status) + '">' + esc(o.status || 'Pending') + '</span></div><div class="meta">';
              html += esc(o.firstname || '') + ' ' + esc(o.lastname || '') + ' · ' + esc(o.phone || '') + '<br>';
              html += esc(o.address || '') + ', ' + esc(o.town || '') + ', ' + esc(o.state || '') + '<br>';
              html += 'Total: ₦' + Number(o.total || 0).toLocaleString() + '<br>';
              html += 'Pay: ' + esc(o.payment_method || '–') + ' · ' + esc(o.payment_status || 'pending') + '<br>Ref: ' + esc(o.payment_reference || o.id);
              if (itemsText) html += '<br>Items: ' + itemsText;
              if (o.tracking_number) {
                html += '<br>Track: ' + esc(o.tracking_number);
                if (o.logistics) html += ' (' + esc(o.logistics) + ')';
                if (o.eta) html += ' · ETA ' + esc(o.eta);
              }
              if (o.ae_order_id) html += '<br>AliExpress order: ' + esc(o.ae_order_id);
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
          } catch (err) { box.innerHTML = '<p style="opacity:0.7">Could not load orders.</p>'; }
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
        async function updateOrder() {
          var msg = document.getElementById('updateMsg');
          var orderId = document.getElementById('u_orderId').value.trim();
          if (!orderId) { msg.style.color = '#e74c3c'; msg.textContent = 'Select an order first'; return; }
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
            msg.style.color = '#27ae60'; msg.textContent = 'Order updated'; showToast('Order updated');
            loadOrders();
          } catch (err) { msg.style.color = '#e74c3c'; msg.textContent = err.message || 'Update failed'; }
        }
        async function markPaidAndApprove() {
          document.getElementById('u_status').value = 'Approved';
          document.getElementById('u_payment').value = 'paid';
          await updateOrder();
        }
        async function quickConfirm(orderId) {
          try {
            var res = await fetch('/api/orders-update', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: orderId, status: 'Approved', payment_status: 'paid' })
            });
            var data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            showToast('Bank transfer confirmed'); loadOrders();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function placeOnAe(orderId) {
          var order = (window.adminOrders || []).find(function(item) { return item.id === orderId; });
          var itemSummary = order && Array.isArray(order.items) ? order.items.map(function(item) { return (item.product_name || 'Item') + ' x' + item.quantity; }).join(', ') : 'Review items in the order card';
          var destination = order ? [order.firstname, order.lastname, order.address, order.town, order.lga, order.state, order.phone].filter(Boolean).join(', ') : 'Review delivery details in the order card';
          if (!confirm('MANUAL REVIEW — this will submit a real supplier purchase.\n\nOrder: ' + orderId + '\nItems: ' + itemSummary + '\nDeliver to: ' + destination + '\n\nConfirm customer payment, product variant and delivery address before continuing.')) return;
          try {
            var res = await fetch('/api/ae-place-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId }) });
            var data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Supplier order failed');
            alert('AliExpress order reference: ' + (data.ae_order_id || 'already submitted'));
            loadOrders();
          } catch (err) { alert(err.message || 'Could not place supplier order'); }
        }
        async function pullTracking(orderId) {
          try {
            var res = await fetch('/api/ae-tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId }) });
            var data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Tracking refresh failed');
            alert(data.tracking ? ('Tracking: ' + data.tracking.number + (data.tracking.carrier ? ' (' + data.tracking.carrier + ')' : '')) : (data.message || 'No tracking number yet'));
            loadOrders();
          } catch (err) { alert(err.message || 'Could not refresh tracking'); }
        }
        window.selectOrder = selectOrder;
        window.quickConfirm = quickConfirm;
        window.selectOrderByIndex = function(idx) { if (window.adminOrders && window.adminOrders[idx]) selectOrder(window.adminOrders[idx]); };
        window.quickConfirmByIndex = function(idx) { if (window.adminOrders && window.adminOrders[idx]) quickConfirm(window.adminOrders[idx].id); };
        window.placeOnAeByIndex = function(idx) { if (window.adminOrders && window.adminOrders[idx]) placeOnAe(window.adminOrders[idx].id); };
        window.pullTrackingByIndex = function(idx) { if (window.adminOrders && window.adminOrders[idx]) pullTracking(window.adminOrders[idx].id); };
        window.loadOrders = loadOrders;
        window.updateOrder = updateOrder;
        window.markPaidAndApprove = markPaidAndApprove;
        loadOrders();
      })();
    }

    /* ===== Admin Messages ===== */
    if (["/admin/messages.html"].includes(path)) {
      (function () {
        var allUsers = [], selectedUser = null;
        function renderUserList(users) {
          var box = document.getElementById('usersSide');
          if (!users.length) { box.innerHTML = '<p style="opacity:0.7;font-size:13px">No users</p>'; return; }
          var html = '';
          for (var i = 0; i < users.length; i++) {
            var u = users[i];
            var active = selectedUser && selectedUser.id === u.id ? ' active' : '';
            html += '<div class="user-item' + active + '" data-uid="' + esc(u.id) + '">';
            html += '<strong>@' + esc(u.nickname || '') + '</strong> · ' + esc(u.role || '');
            html += '<small>' + esc(u.firstname || '') + ' ' + esc(u.lastname || '') + ' · ' + esc(u.email || '') + '</small></div>';
          }
          box.innerHTML = html;
          box.querySelectorAll('.user-item').forEach(function(el) {
            el.addEventListener('click', function() {
              var id = el.getAttribute('data-uid');
              var user = allUsers.find(function(u){ return String(u.id) === id; });
              if (user) selectUser(user);
            });
          });
        }
        async function loadUsers() {
          try {
            var res = await fetch('/api/users');
            var data = await res.json();
            allUsers = data.users || [];
            renderUserList(allUsers);
          } catch (e) { document.getElementById('usersSide').innerHTML = '<p style="opacity:0.7">Could not load users</p>'; }
        }
        function filterUserList() {
          var q = (document.getElementById('userSearch').value || '').toLowerCase();
          var filtered = allUsers.filter(function(u) {
            if (!q) return true;
            return [u.nickname, u.email, u.firstname, u.lastname, u.phone, u.role].join(' ').toLowerCase().indexOf(q) !== -1;
          });
          renderUserList(filtered);
        }
        function selectUser(u) {
          selectedUser = u;
          document.getElementById('threadTitle').textContent = 'Chat with @' + (u.nickname || 'user');
          renderUserList(allUsers);
          loadThread();
        }
        async function loadThread() {
          var box = document.getElementById('threadBox');
          if (!selectedUser) { box.innerHTML = '<p style="opacity:0.7">Select a user first.</p>'; return; }
          box.innerHTML = '<p style="opacity:0.7">Loading...</p>';
          try {
            var res = await fetch('/api/messages?user_id=' + encodeURIComponent(selectedUser.id));
            var data = await res.json();
            var msgs = data.messages || [];
            if (!msgs.length) { box.innerHTML = '<p style="opacity:0.7">No messages yet. Send the first one.</p>'; return; }
            var html = '';
            for (var i = 0; i < msgs.length; i++) {
              var m = msgs[i], isMe = (m.sender_role === 'admin');
              html += '<div class="bubble ' + (isMe ? 'me' : 'them') + '">';
              html += '<div class="meta">' + esc(m.sender_name || m.sender_role || '') + ' · ' + esc(m.created_at || '') + '</div>';
              html += esc(m.message || '') + '</div>';
            }
            box.innerHTML = html;
            box.scrollTop = box.scrollHeight;
          } catch (e) { box.innerHTML = '<p style="opacity:0.7">Could not load messages.</p>'; }
        }
        async function sendAdminReply() {
          if (!selectedUser) { alert('Select a user first'); return; }
          var text = document.getElementById('msgInput').value.trim();
          if (!text || !adminUser.id) return;
          try {
            var res = await fetch('/api/messages', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sender_id: adminUser.id, sender_role: 'admin', sender_name: 'Admin', receiver_id: selectedUser.id, receiver_role: selectedUser.role || 'customer', message: text })
            });
            var data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            document.getElementById('msgInput').value = '';
            showToast('Sent'); loadThread(); loadAllMessages();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function loadAllMessages() {
          var box = document.getElementById('allFeed');
          try {
            var res = await fetch('/api/messages?all=1');
            var data = await res.json();
            var msgs = data.messages || [];
            if (!msgs.length) { box.innerHTML = '<p style="opacity:0.7">No messages yet.</p>'; return; }
            var html = '';
            for (var i = 0; i < Math.min(msgs.length, 40); i++) {
              var m = msgs[i];
              html += '<div style="padding:8px 0;border-bottom:1px solid var(--border)">';
              html += '<strong>' + esc(m.sender_name || m.sender_role || '') + '</strong> → ' + esc(m.receiver_role || '');
              html += '<br>' + esc(m.message || '');
              html += '<br><span style="opacity:0.6">' + esc(m.created_at || '') + '</span></div>';
            }
            box.innerHTML = html;
          } catch (e) { box.innerHTML = '<p style="opacity:0.7">Could not load feed.</p>'; }
        }
        window.selectUser = selectUser;
        window.filterUserList = filterUserList;
        window.sendAdminReply = sendAdminReply;
        window.loadThread = loadThread;
        window.loadAllMessages = loadAllMessages;
        loadUsers();
        loadAllMessages();
      })();
    }

    /* ===== Admin Analytics ===== */
    if (["/admin/analytics.html"].includes(path)) {
      (function () {
        var status = document.getElementById('status');
        function number(v){return Number(v||0).toLocaleString('en-NG')}
        async function load() {
          status.className='status'; status.textContent='Loading…';
          try {
            var days = Number(document.getElementById('range').value) || 7;
            var response = await fetch('/api/analytics?days=' + days, {credentials:'same-origin', cache:'no-store'});
            var data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load analytics');
            document.getElementById('todayViews').textContent = number(data.today.page_views);
            document.getElementById('todayVisitors').textContent = number(data.today.visitors);
            document.getElementById('todayProducts').textContent = number(data.today.product_views);
            var total = (data.daily||[]).reduce(function(sum,d){return sum+Number(d.page_views||0)},0);
            document.getElementById('rangeViews').textContent = number(total);
            var rows = data.daily || [];
            var max = Math.max(1, ...rows.map(function(d){return Number(d.page_views||0)}));
            document.getElementById('chart').innerHTML = rows.length ? rows.map(function(d){
              var date = String(d.event_date||'').slice(5);
              var count = Number(d.page_views||0);
              var height = Math.max(3, Math.round(count/max*112));
              return '<div class="bar-col" title="'+esc(d.event_date)+': '+number(count)+' page views"><div class="bar-num">'+number(count)+'</div><div class="bar" style="height:'+height+'px"></div><div class="bar-date">'+esc(date)+'</div></div>';
            }).join('') : '<p class="status">No visits recorded yet.</p>';
            document.getElementById('popular').innerHTML = (data.popular_pages||[]).length ? (data.popular_pages||[]).map(function(p){return '<tr><td>'+esc(p.path)+'</td><td>'+number(p.views)+'</td></tr>'}).join('') : '<tr><td colspan="2">No page-view data yet.</td></tr>';
            status.textContent = 'Updated just now';
          } catch (e) {
            status.className = 'status error'; status.textContent = e.message || 'Could not load analytics';
            if (/Admin|sign-in|access required/i.test(status.textContent)) status.textContent = 'Please sign in again with an admin account.';
          }
        }
        window.loadAnalytics = load;
        document.getElementById('refresh').addEventListener('click', load);
        document.getElementById('range').addEventListener('change', load);
        load();
      })();
    }

    /* ===== Admin Products ===== */
    if (["/admin/products.html"].includes(path)) {
      (function () {
        var adminUploadedUrl = '';
        function safeImageUrl(value) {
          var url = String(value || '');
          return /^https?:\/\//i.test(url) ? esc(url) : 'https://via.placeholder.com/80?text=No+Img';
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
            if (!products.length) { box.innerHTML = '<p style="opacity:0.7">No products found.</p>'; return; }
            var html = '';
            for (var i = 0; i < products.length; i++) {
              var p = products[i];
              var id = esc(p.id || '');
              var status = ['approved', 'pending', 'rejected'].includes(p.status) ? p.status : 'pending';
              var img = safeImageUrl(p.image);
              html += '<div class="product-card">';
              html += '<img src="' + img + '" alt="" onerror="this.src=\'https://via.placeholder.com/80?text=No+Img\'">';
              html += '<div class="product-info">';
              html += '<strong>' + esc(p.name || 'Unnamed') + '</strong> <span class="badge ' + status + '">' + status + '</span><br>';
              html += '₦' + Number(p.price || 0).toLocaleString();
              if (p.old_price && Number(p.old_price) > 0) html += ' <s style="opacity:0.6">₦' + Number(p.old_price).toLocaleString() + '</s>';
              html += '<br>Stock: ' + (p.stock != null ? p.stock : 0) + ' · ' + esc(p.category || '–') + '</div>';
              html += '<div style="width:100%">';
              html += '<button type="button" class="secondary" onclick="toggleEdit(\'' + id + '\')">Edit</button>';
              if (status === 'pending') html += '<button type="button" class="success" onclick="setStatus(\'' + id + '\',\'approved\')">Approve</button><button type="button" class="danger" onclick="setStatus(\'' + id + '\',\'rejected\')">Reject</button>';
              if (status === 'approved') html += '<button type="button" class="secondary" onclick="setStatus(\'' + id + '\',\'pending\')">Unpublish</button>';
              html += '<button type="button" class="danger" onclick="deleteProduct(\'' + id + '\')">Delete</button></div>';
              html += '<div class="edit-panel" id="edit-' + id + '">';
              html += '<input type="text" id="e_name_' + id + '" value="' + esc(p.name || '') + '" placeholder="Name">';
              html += '<div class="row2"><input type="number" id="e_price_' + id + '" value="' + (p.price || 0) + '" placeholder="Price"><input type="number" id="e_stock_' + id + '" value="' + (p.stock != null ? p.stock : 0) + '" placeholder="Stock"></div>';
              html += '<div class="row2"><input type="number" id="e_old_' + id + '" value="' + (p.old_price || 0) + '" placeholder="Old price"><input type="text" id="e_cat_' + id + '" value="' + esc(p.category || '') + '" placeholder="Category"></div>';
              html += '<input type="text" id="e_img_' + id + '" value="' + esc(p.image || '') + '" placeholder="Image URL">';
              html += '<textarea id="e_desc_' + id + '" placeholder="Description">' + esc(p.description || '') + '</textarea>';
              html += '<select id="e_status_' + id + '">';
              html += '<option value="approved"' + (status === 'approved' ? ' selected' : '') + '>Approved</option>';
              html += '<option value="pending"' + (status === 'pending' ? ' selected' : '') + '>Pending</option>';
              html += '<option value="rejected"' + (status === 'rejected' ? ' selected' : '') + '>Rejected</option>';
              html += '</select><button type="button" onclick="saveProduct(\'' + id + '\')">Save Changes</button></div></div>';
            }
            box.innerHTML = html;
          } catch (err) { box.innerHTML = '<p style="opacity:0.7">Could not load products.</p>'; }
        }
        async function onAdminFileSelected(e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          if (!file.type || file.type.indexOf('image/') !== 0) { alert('Choose an image file'); return; }
          if (file.size > 3 * 1024 * 1024) { alert('Max 3MB'); return; }
          var prev = document.getElementById('adminImgPreview');
          prev.src = URL.createObjectURL(file); prev.style.display = 'block';
          var msg = document.getElementById('addMsg');
          msg.style.color = 'var(--text)'; msg.textContent = 'Uploading image...';
          try {
            var form = new FormData(); form.append('file', file);
            var res = await fetch('/api/upload', { method: 'POST', body: form });
            var data = await res.json();
            if (!data.ok || !data.url) throw new Error(data.error || 'Upload failed');
            adminUploadedUrl = data.url; document.getElementById('p_image').value = data.url;
            msg.style.color = '#27ae60'; msg.textContent = 'Image uploaded';
          } catch (err) { adminUploadedUrl = ''; msg.style.color = '#e74c3c'; msg.textContent = err.message || 'Upload failed'; }
        }
        async function addProduct() {
          var msg = document.getElementById('addMsg');
          var name = document.getElementById('p_name').value.trim();
          var price = Number(document.getElementById('p_price').value);
          if (!name || !price) { msg.style.color = '#e74c3c'; msg.textContent = 'Name and price are required'; return; }
          try {
            var res = await fetch('/api/products', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name, price: price, old_price: Number(document.getElementById('p_old_price').value) || 0,
                category: document.getElementById('p_category').value.trim() || 'others',
                stock: Number(document.getElementById('p_stock').value) || 0,
                image: document.getElementById('p_image').value.trim() || adminUploadedUrl || '',
                description: document.getElementById('p_desc').value.trim(), status: 'approved'
              })
            });
            var data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            msg.style.color = '#27ae60'; msg.textContent = 'Product added'; showToast('Product added');
            document.getElementById('p_name').value = ''; document.getElementById('p_price').value = ''; document.getElementById('p_desc').value = '';
            document.getElementById('p_image').value = ''; document.getElementById('p_image_file').value = ''; adminUploadedUrl = '';
            document.getElementById('adminImgPreview').style.display = 'none';
            loadProducts();
          } catch (err) { msg.style.color = '#e74c3c'; msg.textContent = err.message || 'Failed'; }
        }
        async function importProduct() {
          var url = document.getElementById('importUrl').value.trim();
          var msg = document.getElementById('importMsg');
          if (!url) { alert('Paste a product URL first'); return; }
          if (msg) { msg.style.color = '#C4FF61'; msg.textContent = 'Importing from AliExpress…'; }
          try {
            var res = await fetch('/api/import-aliexpress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url, status: 'pending' }) });
            var data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Import failed');
            if (msg) { msg.style.color = '#27ae60'; msg.textContent = 'Imported: ' + (data.product && data.product.name ? data.product.name : data.id); }
            document.getElementById('importUrl').value = ''; showToast('Product imported'); loadProducts();
          } catch (err) {
            if (msg) { msg.style.color = '#e74c3c'; msg.textContent = err.message || 'Import failed'; } else alert(err.message || 'Import failed');
          }
        }
        function toggleEdit(id) { var el = document.getElementById('edit-' + id); if (el) el.classList.toggle('open'); }
        async function saveProduct(id) {
          try {
            var res = await fetch('/api/products', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update', id: id, name: document.getElementById('e_name_' + id).value.trim(),
                price: Number(document.getElementById('e_price_' + id).value), stock: Number(document.getElementById('e_stock_' + id).value),
                old_price: Number(document.getElementById('e_old_' + id).value) || 0, category: document.getElementById('e_cat_' + id).value.trim(),
                image: document.getElementById('e_img_' + id).value.trim(), description: document.getElementById('e_desc_' + id).value.trim(),
                status: document.getElementById('e_status_' + id).value
              })
            });
            var data = await res.json(); if (!data.ok) throw new Error(data.error || 'Failed');
            showToast('Product updated'); loadProducts();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function setStatus(id, status) {
          try {
            var res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_status', id: id, status: status }) });
            var data = await res.json(); if (!data.ok) throw new Error(data.error || 'Failed');
            showToast('Status: ' + status); loadProducts();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function deleteProduct(id) {
          if (!confirm('Delete this product?')) return;
          try {
            var res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: id }) });
            var data = await res.json(); if (!data.ok) throw new Error(data.error || 'Failed');
            showToast('Product deleted'); loadProducts();
          } catch (err) { alert(err.message || 'Failed'); }
        }
        async function testAeApi() {
          var result = document.getElementById('aeApiTestResult'), input = document.getElementById('searchKw');
          var keyword = input.value.trim() || 'phone case';
          result.style.color = 'var(--text)'; result.textContent = 'Testing the AliExpress search API with "' + keyword + '"…';
          try {
            var res = await fetch('/api/import-aliexpress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ae_search', keywords: keyword }) });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.ok) throw new Error('HTTP ' + res.status + ': ' + (data.error || 'The API request failed.'));
            var count = Array.isArray(data.items) ? data.items.length : 0;
            result.style.color = count ? '#27ae60' : '#f39c12';
            result.textContent = count ? 'API connection successful. AliExpress returned ' + count + ' product(s). Try Search to view them.' : 'The API endpoint responded successfully, but returned 0 usable products.';
          } catch (err) { result.style.color = '#e74c3c'; result.textContent = 'API test failed: ' + (err.message || 'Unknown error'); }
        }
        async function searchAe() {
          var q = document.getElementById('searchKw').value.trim(), box = document.getElementById('searchResults');
          if (!q) return alert('Enter a keyword');
          box.innerHTML = '<p>Searching AliExpress…</p>';
          try {
            var res = await fetch('/api/import-aliexpress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ae_search', keywords: q }) });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.ok) throw new Error(data.error || ('Search failed (HTTP ' + res.status + ').'));
            var items = Array.isArray(data.items) ? data.items : [];
            if (!items.length) { box.innerHTML = '<p style="color:#e74c3c">AliExpress returned no products for this search.</p>'; return; }
            box.innerHTML = items.map(function (it) {
              return '<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" class="aePick" value="' + esc(it.product_id) + '"><img src="' + safeImageUrl(it.image) + '" width="48" height="48" style="object-fit:cover"><span>' + esc(String(it.title || 'Untitled').slice(0, 100)) + ' — ₦' + Number(it.price_ngn || 0).toLocaleString() + '</span></label>';
            }).join('') + '<button type="button" onclick="bulkImportAe()">Import selected</button>';
          } catch (err) { box.innerHTML = '<p style="color:#e74c3c">' + esc(err.message || 'AliExpress search failed. Please try again.') + '</p>'; }
        }
        async function bulkImportAe() {
          var ids = Array.from(document.querySelectorAll('.aePick:checked')).map(function (el) { return el.value; });
          if (!ids.length) return alert('Select at least one');
          var res = await fetch('/api/import-aliexpress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ae_bulk_import', product_ids: ids, status: 'pending' }) });
          var data = await res.json(); alert(JSON.stringify(data.results || data, null, 2)); loadProducts();
        }
        window.toggleEdit = toggleEdit; window.saveProduct = saveProduct; window.setStatus = setStatus; window.deleteProduct = deleteProduct;
        window.onAdminFileSelected = onAdminFileSelected; window.addProduct = addProduct; window.importProduct = importProduct;
        window.testAeApi = testAeApi; window.searchAe = searchAe; window.bulkImportAe = bulkImportAe; window.loadProducts = loadProducts;
        loadProducts();
      })();
    }
  }
})();