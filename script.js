/* Shared store navigation behavior. */
(() => {
  function getDrawer() { return document.getElementById('navDrawer'); }
  function setExpanded(open) {
    document.querySelectorAll('[onclick*="toggleNav"], [aria-controls="navDrawer"]').forEach((button) => {
      button.setAttribute('aria-expanded', String(open));
    });
  }
  const sharedToggleNav = function toggleNav() {
    const drawer = getDrawer();
    if (!drawer) return;
    const open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    setExpanded(open);
  };
  // Page-specific scripts may still declare their legacy toggleNav; reassert the shared handler after parsing.
  window.toggleNav = sharedToggleNav;
  document.addEventListener('DOMContentLoaded', () => { window.toggleNav = sharedToggleNav; });
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
