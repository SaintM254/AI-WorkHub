import { createClient } from '@supabase/supabase-js';
import { validateApplication, isConfigured, balanceFromPayments } from './validation.js';
const $ = id => document.getElementById(id);
const config = window.AI_WORKHUB_CONFIG;
const loginButton = $('google-login');
let client;
let currentUser;
let loading = false;
let identityVersion = 0;
const money = amount => `KSh ${Number(amount).toLocaleString('en-KE')}`;
function notice(text, error = false) { $('portal-status').textContent = text; $('portal-status').classList.toggle('error', error); }
function showLogin() {
  identityVersion += 1;
  currentUser = null;
  $('member-view').hidden = true;
  $('dashboard').hidden = true;
  $('new-application').hidden = true;
  $('student-name').textContent = '';
  $('student-email').textContent = '';
  $('resource-list').replaceChildren();
  $('certificate-list').replaceChildren();
  $('student-application').reset();
  $('submit-status').textContent = '';
  $('student-instalments').hidden = true;
  $('login-view').hidden = false;
  loginButton.disabled = !client;
}
async function openPrivateFile(bucket, path, button) {
  button.disabled = true;
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) throw error || new Error('No URL');
    if (tab) tab.location.replace(data.signedUrl);
    else window.location.assign(data.signedUrl);
  } catch {
    tab?.close();
    notice('This file could not be opened. Your access may have changed. Refresh or contact AI WorkHub.', true);
  } finally { button.disabled = false; }
}
function renderFiles(items, container, bucket) {
  container.replaceChildren();
  for (const item of items) {
    const row = document.createElement('li');
    const title = document.createElement('h3'); title.textContent = item.title;
    row.append(title);
    if (item.description) { const p = document.createElement('p'); p.textContent = item.description; row.append(p); }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'portal-secondary';
    button.textContent = 'Open file ↗';
    button.addEventListener('click', () => openPrivateFile(bucket, item.file_path, button));
    row.append(button); container.append(row);
  }
}
async function loadMember() {
  if (loading) return;
  loading = true;
  const version = identityVersion;
  $('refresh-dashboard').disabled = true;
  $('dashboard').hidden = true;
  $('new-application').hidden = true;
  notice('Loading your enrolment…');
  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (version !== identityVersion) return;
    if (authError || !auth.user) { showLogin(); notice('Please sign in to access your student account.'); return; }
    currentUser = auth.user;
    $('login-view').hidden = true;
    $('member-view').hidden = false;
    $('student-name').textContent = currentUser.user_metadata?.full_name || 'learner';
    $('student-email').textContent = currentUser.email || '';
    const { data: application, error } = await client.from('applications').select('id,full_name,payment_plan,status').eq('user_id', currentUser.id).maybeSingle();
    if (version !== identityVersion) return;
    if (error) throw error;
    if (!application) {
      $('student-full-name').value = currentUser.user_metadata?.full_name || '';
      $('new-application').hidden = false;
      notice(''); return;
    }
    const [{ data: payments, error: paymentError }, { data: resources, error: resourceError }, { data: certificates, error: certError }] = await Promise.all([
      client.from('payments').select('amount_kes').eq('user_id', currentUser.id),
      client.from('course_resources').select('id,title,description,file_path').order('sort_order'),
      client.from('certificates').select('id,title,file_path').eq('user_id', currentUser.id)
    ]);
    if (version !== identityVersion) return;
    if (paymentError || resourceError || certError) throw paymentError || resourceError || certError;
    const labels = { pending: 'Pending review', approved: 'Approved', declined: 'Not approved' };
    $('enrolment-status').textContent = labels[application.status] || 'Under review';
    $('enrolment-help').textContent = application.status === 'approved' ? 'Your classroom is ready below.' : application.status === 'pending' ? 'We have your application. AI WorkHub will review it before granting course access.' : 'Contact AI WorkHub to discuss your application.';
    $('payment-plan').textContent = application.payment_plan === 'full' ? 'Full payment' : 'Instalments';
    $('payment-help').textContent = application.payment_plan === 'full' ? 'KSh 10,000 upfront.' : 'KSh 5,000 on enrolment + KSh 5,000 to receive your certificate.';
    $('payment-balance').textContent = money(balanceFromPayments(payments));
    $('resources-note').textContent = application.status !== 'approved' ? 'Learning resources unlock after your enrolment is approved.' : resources.length ? 'Your course files, available while you are enrolled.' : 'Your instructor has not published any resources yet. Check back soon.';
    renderFiles(resources, $('resource-list'), 'course-materials');
    renderFiles(certificates, $('certificate-list'), 'certificates');
    $('certificate-note').textContent = certificates.length ? 'Your certificate has been released. Congratulations on your progress.' : 'Your certificate will appear after course completion, verified full payment and release by AI WorkHub.';
    $('dashboard').hidden = false;
    notice('');
  } catch {
    if (version !== identityVersion) return;
    notice('We couldn’t load your dashboard. Check your connection and try Refresh. If this continues, contact AI WorkHub.', true);
  } finally { loading = false; $('refresh-dashboard').disabled = false; }
}
loginButton.addEventListener('click', async () => {
  if (!client) return;
  loginButton.disabled = true;
  notice('Opening Google sign-in…');
  try {
    const callback = new URL('student.html', window.location.href);
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.href } });
    if (error) throw error;
  } catch { notice('Google sign-in couldn’t start. Please try again or contact AI WorkHub.', true); loginButton.disabled = false; }
});
$('sign-out').addEventListener('click', async () => {
  $('sign-out').disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    showLogin(); notice('You have signed out.');
  } catch { notice('Sign out failed. Please try again.', true); }
  finally { $('sign-out').disabled = false; }
});
$('refresh-dashboard').addEventListener('click', loadMember);
$('student-application').addEventListener('change', () => {
  $('student-instalments').hidden = $('student-application').elements.paymentPlan.value !== 'instalments';
});
$('student-application').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!currentUser || !client) return;
  const values = Object.fromEntries(new FormData(form));
  const validation = validateApplication(values);
  if (validation) { $('submit-status').textContent = validation; $('submit-status').focus(); return; }
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  $('submit-status').textContent = 'Sending your application…';
  try {
    const { error } = await client.from('applications').insert({ user_id: currentUser.id, full_name: values.fullName.trim(), phone: values.phone.trim(), payment_plan: values.paymentPlan });
    if (error?.code === '23505') { await loadMember(); return; }
    if (error) throw error;
    $('submit-status').textContent = '';
    await loadMember();
  } catch {
    $('submit-status').textContent = 'We couldn’t confirm your application. Your entries are still here. Try again or contact AI WorkHub.';
    $('submit-status').focus();
  } finally { button.disabled = false; }
});
async function start() {
  if (!isConfigured(config)) { showLogin(); notice('Student sign-in is being set up. For enrolment help, WhatsApp 0742 330 046.'); return; }
  client = createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { showLogin(); notice('Please sign in to access your student account.'); }
  });
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await loadMember();
    else {
      showLogin();
      const oauthError = new URLSearchParams(location.search).has('error') || new URLSearchParams(location.hash.slice(1)).has('error');
      notice(oauthError ? 'Sign-in was cancelled or could not be completed. Please try again.' : '', oauthError);
      if (oauthError) history.replaceState(null, '', location.pathname);
    }
  } catch { showLogin(); notice('We couldn’t restore your sign-in. Please try Continue with Google again.', true); }
}
start();
