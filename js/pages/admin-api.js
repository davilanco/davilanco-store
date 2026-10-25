/* Extracted script 1 from admin/api.html */
(function(){
  var token=localStorage.getItem('token'), storedUser=null;
  try{storedUser=JSON.parse(localStorage.getItem('user')||'null')}catch(e){}
  if(!token||!storedUser){window.location.replace('/login.html?redirect='+encodeURIComponent('/admin/api.html'));return}
  if(storedUser.role!=='admin'){alert('Access denied. Admin only.');window.location.replace('/dashboard.html');return}

  // File list mirrors functions/api/*.js and functions/api/paystack/*.js in the repository.
  // "Risky" routes are explicitly marked and require typing RUN before this console sends a request.
  var apis=[
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
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  document.getElementById('count').textContent='('+apis.length+' routes)';
  select.innerHTML=apis.map(function(a,i){return '<option value="'+i+'">'+esc(a.path)+' — '+esc(a.method)+'</option>'}).join('');
  function choose(i){
    selected=i;select.value=String(i);method.value=apis[i].method;
    document.getElementById('fileHint').textContent=apis[i].file+' · '+apis[i].note+(apis[i].risk?' · Extra caution required':'');
    renderCatalog();
  }
  function renderCatalog(){
    var q=filter.value.trim().toLowerCase();
    var matches=apis.map(function(a,i){return {a:a,i:i}}).filter(function(x){return !q||(x.a.path+' '+x.a.file+' '+x.a.note).toLowerCase().includes(q)});
    catalog.innerHTML=matches.map(function(x){var a=x.a;return '<div class="api-item '+(x.i===selected?'active':'')+'"><div><div class="api-name">'+esc(a.path)+'</div><div class="api-file">'+esc(a.file)+'</div><span class="badge">'+esc(a.method)+' default</span>'+(a.risk?'<span class="badge risk">'+(a.destructive?'DESTRUCTIVE':'LIVE SIDE EFFECTS')+'</span>':'<span class="badge read">LOWER RISK</span>')+'<div class="small muted">'+esc(a.note)+'</div></div><button type="button" data-use="'+x.i+'">Select</button></div>'}).join('')||'<p class="muted">No routes match your search.</p>';
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
      var options={method:verb,headers:{'Accept':'application/json','Authorization':'Bearer '+token,'Cache-Control':'no-store'}};
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