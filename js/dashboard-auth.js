/* Independent dashboard gate: runs before dashboard content can be revealed. */
(function () {
  'use strict';
  var main = document.getElementById('dashboardPrivateContent');
  function redirect() {
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
    window.location.replace('/login.html?redirect=' + encodeURIComponent('/dashboard.html'));
  }
  fetch('/api/session', { credentials:'same-origin', cache:'no-store', headers:{'Accept':'application/json'} })
    .then(function (response) { return response.json().catch(function(){return {};}).then(function(data){
      if (!response.ok || !data.ok || !data.user || !data.user.id) throw new Error('LOGIN_REQUIRED');
      window.dvlDashboardSessionUser = data.user;
      if (main) { main.hidden = false; main.style.removeProperty('display'); }
      var dash = document.querySelector('a[href="/dashboard.html"]');
      if (dash) dash.hidden = false;
      var logout = document.getElementById('logoutBtn');
      if (logout) logout.hidden = false;
      var seller = document.getElementById('sellerLink');
      var admin = document.getElementById('adminLink');
      if (seller) seller.hidden = !(data.user.role === 'seller' || data.user.role === 'admin');
      if (admin) admin.hidden = data.user.role !== 'admin';
    }); })
    .catch(redirect);
})();
