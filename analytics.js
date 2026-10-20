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
