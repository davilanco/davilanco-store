/* Shared store navigation behavior. */
(() => {
  function getDrawer() { return document.getElementById('navDrawer'); }
  function setExpanded(open) {
    document.querySelectorAll('[onclick*="toggleNav"], [aria-controls="navDrawer"]').forEach((button) => {
      button.setAttribute('aria-expanded', String(open));
    });
  }
  window.toggleNav = function toggleNav() {
    const drawer = getDrawer();
    if (!drawer) return;
    const open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    setExpanded(open);
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const drawer = getDrawer();
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        setExpanded(false);
      }
    }
  });
})();
