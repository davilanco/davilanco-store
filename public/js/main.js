function toggleTheme(){
  const html=document.documentElement;
  const cur=html.getAttribute('data-theme');
  const next=cur==='dark'?'light':'dark';
  html.setAttribute('data-theme',next);
  localStorage.setItem('theme',next);
}
(function(){
  const saved=localStorage.getItem('theme');
  if(saved) document.documentElement.setAttribute('data-theme',saved);
  else if(window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme','dark');
  window.addEventListener('scroll',()=>{
    const b=document.getElementById('backTop');
    if(!b) return;
    b.style.display=window.scrollY>300?'block':'none';
  });
})();
