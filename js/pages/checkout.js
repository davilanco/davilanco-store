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