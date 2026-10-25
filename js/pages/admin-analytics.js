/* Extracted script 1 from admin/analytics.html */
(function(){
  var token=localStorage.getItem('token');
  var storedUser=null;
  try{storedUser=JSON.parse(localStorage.getItem('user')||'null')}catch(e){}
  if(!token||!storedUser){window.location.replace('/login.html?redirect='+encodeURIComponent('/admin/analytics.html'));return}
  var status=document.getElementById('status');
  function number(v){return Number(v||0).toLocaleString('en-NG')}
  function escapeText(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  async function load(){
    status.className='status';status.textContent='Loading…';
    try{
      var days=Number(document.getElementById('range').value)||7;
      var response=await fetch('/api/analytics?days='+days,{headers:{'Authorization':'Bearer '+token},cache:'no-store'});
      var data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not load analytics');
      document.getElementById('todayViews').textContent=number(data.today.page_views);
      document.getElementById('todayVisitors').textContent=number(data.today.visitors);
      document.getElementById('todayProducts').textContent=number(data.today.product_views);
      var total=(data.daily||[]).reduce(function(sum,d){return sum+Number(d.page_views||0)},0);
      document.getElementById('rangeViews').textContent=number(total);
      var rows=data.daily||[];
      var max=Math.max(1,...rows.map(function(d){return Number(d.page_views||0)}));
      document.getElementById('chart').innerHTML=rows.length?rows.map(function(d){
        var date=String(d.event_date||'').slice(5);
        var count=Number(d.page_views||0);
        var height=Math.max(3,Math.round(count/max*112));
        return '<div class="bar-col" title="'+escapeText(d.event_date)+': '+number(count)+' page views"><div class="bar-num">'+number(count)+'</div><div class="bar" style="height:'+height+'px"></div><div class="bar-date">'+escapeText(date)+'</div></div>';
      }).join(''):'<p class="status">No visits recorded yet. Visit the public store to create the first test entry.</p>';
      document.getElementById('popular').innerHTML=(data.popular_pages||[]).length?(data.popular_pages||[]).map(function(p){return '<tr><td>'+escapeText(p.path)+'</td><td>'+number(p.views)+'</td></tr>'}).join(''):'<tr><td colspan="2">No page-view data yet.</td></tr>';
      status.textContent='Updated just now';
    }catch(e){
      status.className='status error';
      status.textContent=e.message||'Could not load analytics';
      if(/Admin|sign-in|access required/i.test(status.textContent)){status.textContent='Please sign in again with an admin account.'}
    }
  }
  document.getElementById('refresh').addEventListener('click',load);
  document.getElementById('range').addEventListener('change',load);
  load();
})();