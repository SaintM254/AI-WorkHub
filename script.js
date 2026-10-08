const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
const mobileLayout = window.matchMedia('(max-width: 800px)');
const background = [document.querySelector('.header > .brand'), document.querySelector('main'), document.querySelector('footer')];
function closeMenu(restoreFocus = false) {
  const wasOpen = nav.classList.contains('open');
  nav.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
  document.body.classList.remove('menu-open');
  background.forEach(element => { element.inert = false; });
  if (restoreFocus && wasOpen) menu.focus();
}
menu.addEventListener('click', () => {
  if (nav.classList.contains('open')) return closeMenu(true);
  nav.classList.add('open');
  menu.setAttribute('aria-expanded', 'true');
  menu.setAttribute('aria-label', 'Close navigation');
  document.body.classList.add('menu-open');
  background.forEach(element => { element.inert = true; });
  nav.querySelector('a').focus();
});
document.querySelector('.menu-close').addEventListener('click', () => closeMenu(true));
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  closeMenu();
  const href = link.getAttribute('href');
  const target = href?.startsWith('#') && href.length > 1 ? document.querySelector(href) : null;
  if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
}));
mobileLayout.addEventListener('change', () => closeMenu());
document.addEventListener('keydown', event => {
  if (!nav.classList.contains('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
  if (event.key === 'Tab') {
    const items = [menu, ...nav.querySelectorAll('a, button')];
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
// Google sign-in precedes applications; returning students use the same portal.
document.querySelectorAll('[data-enrol]').forEach(button => button.addEventListener('click', () => {
  closeMenu();
  window.location.assign(new URL('student.html', window.location.href).href);
}));
document.querySelector('#year').textContent = new Date().getFullYear();

// Android browser controls can shift the visual viewport relative to layout coordinates.
// Keep the fixed mobile chrome at the visible top; do not counteract pinch zoom.
function syncMobileViewport() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  if (!mobileLayout.matches || !viewport || Math.abs(viewport.scale - 1) > 0.01) {
    root.style.removeProperty('--mobile-viewport-top');
    root.style.removeProperty('--mobile-viewport-height');
    return;
  }
  root.style.setProperty('--mobile-viewport-top', `${Math.max(0, viewport.offsetTop)}px`);
  root.style.setProperty('--mobile-viewport-height', `${viewport.height}px`);
}
let viewportFrame = 0;
function queueViewportSync() {
  if (viewportFrame) return;
  viewportFrame = requestAnimationFrame(() => {
    viewportFrame = 0;
    syncMobileViewport();
  });
}
window.visualViewport?.addEventListener('scroll', queueViewportSync, { passive: true });
window.visualViewport?.addEventListener('resize', queueViewportSync, { passive: true });
window.addEventListener('scroll', queueViewportSync, { passive: true });
window.addEventListener('resize', queueViewportSync, { passive: true });
window.addEventListener('pageshow', queueViewportSync);
mobileLayout.addEventListener('change', queueViewportSync);
syncMobileViewport();
