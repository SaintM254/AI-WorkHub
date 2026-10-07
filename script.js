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
  const target = document.querySelector(link.getAttribute('href'));
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
const dialog = document.querySelector('#enrol-dialog');
const form = document.querySelector('#application-form');
const status = document.querySelector('#application-status');
let applicationTrigger;
document.querySelectorAll('[data-enrol]').forEach(button => button.addEventListener('click', () => {
  applicationTrigger = button;
  closeMenu();
  status.textContent = '';
  dialog.showModal();
  document.body.classList.add('application-open');
}));
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.classList.remove('application-open');
  // A mobile navigation trigger is hidden after closing the menu.
  if (mobileLayout.matches && nav.contains(applicationTrigger)) menu.focus();
  else applicationTrigger?.focus();
});
dialog.addEventListener('click', event => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
});
form.addEventListener('change', () => {
  document.querySelector('#instalment-details').hidden = form.elements.paymentPlan.value !== 'instalments';
  status.textContent = '';
});
const nameInput = document.querySelector('#full-name');
const phoneInput = document.querySelector('#phone');
function validateContact() {
  nameInput.setCustomValidity(nameInput.value.trim() ? '' : 'Please enter your full name.');
  const phone = phoneInput.value.trim();
  const digits = phone.replace(/\D/g, '');
  phoneInput.setCustomValidity(/^\+?[\d\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15 ? '' : 'Please enter a valid phone number with 7–15 digits.');
}
[nameInput, phoneInput].forEach(input => input.addEventListener('input', validateContact));
form.addEventListener('submit', event => {
  event.preventDefault();
  validateContact();
  if (!form.reportValidity()) return;
  // Backend integration point: validate server-side and submit over HTTPS here.
  // Do not show success or clear the form until the server confirms receipt.
  // This preview deliberately performs no network request or persistent storage.
  status.textContent = 'Applications aren’t open yet. Your details have not been sent. Please check back soon.';
  status.focus();
});
document.querySelector('#year').textContent = new Date().getFullYear();
