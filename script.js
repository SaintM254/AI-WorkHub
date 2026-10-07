const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Open navigation'); }
menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
const dialog = document.querySelector('#enrol-dialog');
document.querySelectorAll('[data-enrol]').forEach(button => button.addEventListener('click', () => { closeMenu(); document.querySelector('#planner-status').textContent = ''; dialog.showModal(); }));
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { const box = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close(); });
document.querySelector('#planner').addEventListener('submit', event => {
  event.preventDefault();
  const goal = document.querySelector('#goal').value;
  const text = `AI WORKHUB — MY LEARNING CHECKLIST\n\nProgramme: AI Essentials & Automation\nDuration: 1 week\nFee: KSh 10,000\nMy learning interest: ${goal}\n\nBefore enrolling:\n[ ] Check the website for official enrolment contact and opening dates.\n[ ] Confirm the timetable, venue and online/in-person format.\n[ ] Confirm final course topics and any required software costs.\n[ ] Plan access to a laptop and reliable internet.\n[ ] Set aside one week and budget KSh 10,000 for the programme.\n[ ] Only pay after official payment instructions are published.\n\nThis checklist is not an application, payment request or seat reservation.\nThe course outline is provisional. No personal information was submitted.\n\nWebsite: ${location.href.split('#')[0]}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'AI-WorkHub-learning-checklist.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  document.querySelector('#planner-status').textContent = 'Your checklist is ready. Check your downloads — no application has been submitted.';
});
document.querySelector('#year').textContent = new Date().getFullYear();
