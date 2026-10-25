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