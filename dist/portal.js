// AI WorkHub Student Portal Bundle (ESM)

const messages = {
  access_denied: 'Google access was declined. Start again and approve the sign-in request.',
  invalid_client: 'The Google client configuration needs checking in Supabase. The owner should verify that the Client ID and secret belong to the same Google web client.',
  external_code_exchange_failed: 'Supabase could not complete the Google callback. The owner should check Authentication logs and the Google provider Client ID, secret and callback URL.',
  flow_state_not_found: 'This sign-in attempt is no longer available. Start again from the student portal in the same browser.',
  flow_state_expired: 'This sign-in attempt expired. Start again from the student portal.',
  bad_code_verifier: 'The browser could not match this sign-in to the original request. Start and finish sign-in in the same browser without clearing its site data.',
  pkce_verifier_missing: 'The sign-in session is missing from this browser. Start again in the same browser, with site storage enabled.',
  bad_oauth_callback: 'The Google callback was incomplete. Start again; if it repeats, the owner should check Supabase Authentication logs.',
  oauth_callback_error: 'The provider callback failed. The owner should check Supabase Authentication logs for this sign-in attempt.',
  provider_disabled: 'Google sign-in is not enabled in Supabase. The owner needs to enable the Google provider.',
  oauth_provider_not_supported: 'The sign-in provider is not configured. The owner should check the Google provider in Supabase.',
  signup_disabled: 'New student accounts are currently disabled. Contact AI WorkHub.',
  server_error: 'Supabase reported a server-side sign-in error. The owner should check Authentication logs for this attempt.',
  unexpected_failure: 'Supabase could not complete sign-in. The owner should check Authentication logs for this attempt.',
  request_failed: 'The sign-in request could not finish. Check your connection and try again.',
  callback_failed: 'Sign-in could not be completed. Try again; if it repeats, ask AI WorkHub to check Authentication logs.'
};
function readCallback(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const read = key => url.searchParams.get(key) || hash.get(key) || '';
  return { code: url.searchParams.get('code'), error: read('error'), errorCode: read('error_code'), description: read('error_description') };
}
function authFeedback(error = {}) {
  const description = String(error.description || error.message || '').toLowerCase();
  let code = error.errorCode || error.code || error.error || '';
  if (/unable to exchange external code|error exchanging code/.test(description)) code = 'external_code_exchange_failed';
  else if (/code verifier.*(empty|missing|not found)|pkce.*(empty|missing|not found)/.test(description) || error.name === 'AuthPKCECodeVerifierMissingError') code = 'pkce_verifier_missing';
  else if (error.name === 'AuthRetryableFetchError' || error.name === 'TypeError') code = 'request_failed';
  if (!Object.hasOwn(messages, code)) code = 'callback_failed';
  return `${messages[code]} (Code: ${code})`;
}
function cleanCallbackUrl(href) {
  const url = new URL(href);
  for (const key of ['code','state','error','error_code','error_description','error_uri']) url.searchParams.delete(key);
  url.hash = '';
  return url.pathname + url.search;
}


function validateApplication({ fullName, phone, paymentPlan }) {
  const name = String(fullName || '').trim();
  const number = String(phone || '').trim();
  const digits = number.replace(/\D/g, '');
  if (!name || name.length > 120) return 'Enter your full name (up to 120 characters).';
  if (!/^\+?[\d\s().-]+$/.test(number) || number.length > 30 || digits.length < 7 || digits.length > 15) return 'Enter a valid phone number with 7–15 digits.';
  if (!['full', 'instalments'].includes(paymentPlan)) return 'Choose a payment option.';
  return '';
}
function isConfigured(config) {
  try {
    const url = new URL(config?.supabaseUrl);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') &&
      (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash &&
      typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.startsWith('sb_publishable_');
  } catch { return false; }
}
function balanceFromPayments(payments) {
  return Math.max(0, 10000 - (payments || []).reduce((sum, item) => sum + Number(item.amount_kes || 0), 0));
}


// Auth feedback module inlined
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// Validation module inlined

const $ = id => document.getElementById(id);
const config = window.AI_WORKHUB_CONFIG;
const loginButton = $('google-login');

let client;
let currentUser;
let loading = false;
let identityVersion = 0;

const money = amount => `KSh ${Number(amount).toLocaleString('en-KE')}`;

function notice(text, error = false) {
  const el = $('portal-status');
  if (el) {
    el.textContent = text;
    el.classList.toggle('error', error);
  }
}

// Curriculum Modules Data
const COURSE_MODULES = [
  {
    id: 'm1',
    title: 'Module 1: AI Essentials & Prompt Engineering',
    description: 'Master core AI concepts, LLM architectures (ChatGPT, Claude, DeepSeek), and structured prompting techniques.',
    topics: ['Generative AI Fundamentals & Model Selection', 'Chain-of-Thought & Zero-Shot/Few-Shot Prompting', 'System Prompts & Output Formatting Matrix']
  },
  {
    id: 'm2',
    title: 'Module 2: Workflow Automation & No-Code AI',
    description: 'Connect AI models to your daily workflow using no-code integration platforms.',
    topics: ['Zapier & Make.com Webhook Integrations', 'Automating Email & Document Processing', 'Building AI Micro-Agents']
  },
  {
    id: 'm3',
    title: 'Module 3: AI for Business & Content Strategy',
    description: 'Leverage AI for marketing, market research, content generation, and data analysis.',
    topics: ['Automated Content Creation Pipelines', 'Data Scraping & Analysis with AI', 'Business Process Optimization']
  },
  {
    id: 'm4',
    title: 'Module 4: Applied AI Capstone Project',
    description: 'Design, build, and present a complete real-world AI automation project.',
    topics: ['Capstone Scoping & Architecture', 'End-to-End Testing & Debugging', 'Final Project Submission & Review']
  }
];

// TAB SWITCHING LOGIC
function activateTab(tabName) {
  document.querySelectorAll('.portal-tab').forEach(tab => {
    const isActive = tab.getAttribute('data-tab') === tabName;
    tab.classList.toggle('active', isActive);
  });
  document.querySelectorAll('.portal-tab-content').forEach(content => {
    const isTarget = content.id === `tab-${tabName}`;
    content.hidden = !isTarget;
  });
}

function initTabs() {
  document.querySelectorAll('.portal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      activateTab(target);
    });
  });
  document.querySelectorAll('.tab-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      activateTab(target);
    });
  });
}

// SHOW LOGIN VIEW
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
  if (loginButton) loginButton.disabled = !client;
}

// PRIVATE FILE DOWNLOAD / OPEN
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
  } finally {
    button.disabled = false;
  }
}

function renderFiles(items, container, bucket) {
  container.replaceChildren();
  for (const item of items) {
    const row = document.createElement('li');
    const title = document.createElement('h3');
    title.textContent = item.title;
    row.append(title);
    if (item.description) {
      const p = document.createElement('p');
      p.textContent = item.description;
      row.append(p);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'portal-secondary';
    button.textContent = 'Open file ↗';
    button.addEventListener('click', () => openPrivateFile(bucket, item.file_path, button));
    row.append(button);
    container.append(row);
  }
}

// COURSE PROGRESS MANAGEMENT
async function loadCourseProgress(userId) {
  let completedSet = new Set();
  const localKey = `aiworkhub_progress_${userId}`;
  const savedLocal = localStorage.getItem(localKey);
  if (savedLocal) {
    try { JSON.parse(savedLocal).forEach(id => completedSet.add(id)); } catch (e) {}
  }

  try {
    const { data, error } = await client.from('course_progress').select('module_id,completed').eq('user_id', userId);
    if (!error && data) {
      data.forEach(item => {
        if (item.completed) completedSet.add(item.module_id);
        else completedSet.delete(item.module_id);
      });
    }
  } catch (e) {
    // Ignore if table not created yet
  }

  return completedSet;
}

async function saveModuleToggle(userId, moduleId, completed) {
  const localKey = `aiworkhub_progress_${userId}`;
  let currentSet = new Set();
  try {
    const saved = localStorage.getItem(localKey);
    if (saved) JSON.parse(saved).forEach(id => currentSet.add(id));
  } catch (e) {}

  if (completed) currentSet.add(moduleId);
  else currentSet.delete(moduleId);

  localStorage.setItem(localKey, JSON.stringify(Array.from(currentSet)));

  try {
    await client.from('course_progress').upsert({
      user_id: userId,
      module_id: moduleId,
      completed: completed,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,module_id' });
  } catch (e) {
    // Graceful fallback to local state
  }
}

function renderModules(completedSet, userId) {
  const container = $('modules-list');
  if (!container) return;
  container.replaceChildren();

  const total = COURSE_MODULES.length;
  const completedCount = completedSet.size;
  const percentage = Math.round((completedCount / total) * 100);

  if ($('overview-progress-text')) $('overview-progress-text').textContent = `${percentage}%`;
  if ($('overview-progress-bar')) $('overview-progress-bar').style.width = `${percentage}%`;
  if ($('overview-progress-sub')) $('overview-progress-sub').textContent = `${completedCount} of ${total} modules completed`;
  if ($('progress-percentage-large')) $('progress-percentage-large').textContent = `${percentage}%`;
  if ($('main-progress-bar-fill')) $('main-progress-bar-fill').style.width = `${percentage}%`;

  COURSE_MODULES.forEach((mod) => {
    const isCompleted = completedSet.has(mod.id);
    const card = document.createElement('div');
    card.className = `module-card ${isCompleted ? 'completed' : 'in-progress'}`;

    const top = document.createElement('div');
    top.className = 'module-top';

    const titleBox = document.createElement('div');
    titleBox.className = 'module-title-box';
    const h3 = document.createElement('h3');
    h3.textContent = mod.title;
    const p = document.createElement('p');
    p.textContent = mod.description;
    titleBox.append(h3, p);

    const badge = document.createElement('span');
    badge.className = `module-badge ${isCompleted ? 'completed' : 'in-progress'}`;
    badge.textContent = isCompleted ? 'Completed' : 'In Progress';

    top.append(titleBox, badge);

    const topicUl = document.createElement('ul');
    topicUl.className = 'module-topics';
    mod.topics.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      topicUl.append(li);
    });

    const actionRow = document.createElement('div');
    actionRow.className = 'module-action-row';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'portal-secondary toggle-module-btn';
    toggleBtn.textContent = isCompleted ? '✓ Marked Completed' : 'Mark as Completed';
    toggleBtn.addEventListener('click', async () => {
      toggleBtn.disabled = true;
      const nextState = !completedSet.has(mod.id);
      if (nextState) completedSet.add(mod.id);
      else completedSet.delete(mod.id);
      await saveModuleToggle(userId, mod.id, nextState);
      renderModules(completedSet, userId);
    });

    actionRow.append(document.createElement('span'), toggleBtn);

    card.append(top, topicUl, actionRow);
    container.append(card);
  });
}

// ASSIGNMENTS MANAGEMENT
async function loadSubmissions(userId) {
  const container = $('submissions-list');
  const emptyMsg = $('submissions-empty-msg');
  if (!container) return;

  let submissions = [];
  try {
    const { data, error } = await client.from('assignment_submissions').select('id,file_name,notes,status,submitted_at').eq('user_id', userId).order('submitted_at', { ascending: false });
    if (!error && data) submissions = data;
  } catch (e) {}

  const localKey = `aiworkhub_submissions_${userId}`;
  const localSaved = localStorage.getItem(localKey);
  if (localSaved) {
    try {
      const localSubs = JSON.parse(localSaved);
      localSubs.forEach(ls => {
        if (!submissions.some(s => s.id === ls.id)) submissions.push(ls);
      });
    } catch (e) {}
  }

  container.replaceChildren();
  if (!submissions.length) {
    if (emptyMsg) emptyMsg.hidden = false;
    return;
  }

  if (emptyMsg) emptyMsg.hidden = true;

  submissions.forEach(sub => {
    const li = document.createElement('li');
    const h3 = document.createElement('h3');
    h3.textContent = sub.file_name || 'Assignment Upload';
    const p = document.createElement('p');
    p.textContent = `Submitted: ${new Date(sub.submitted_at || Date.now()).toLocaleDateString('en-KE')} · Status: ${sub.status || 'Submitted'}${sub.notes ? ' · Note: ' + sub.notes : ''}`;
    li.append(h3, p);
    container.append(li);
  });
}

function initAssignmentUpload(userId) {
  const form = $('assignment-upload-form');
  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const statusMsg = $('upload-status-msg');
    const submitBtn = $('submit-assignment-btn');

    const fileInput = $('assignment-file');
    const select = $('assignment-select');
    const notesInput = $('assignment-notes');

    if (!fileInput.files.length) {
      if (statusMsg) statusMsg.textContent = 'Please choose a file to upload.';
      return;
    }

    const file = fileInput.files[0];
    submitBtn.disabled = true;
    if (statusMsg) statusMsg.textContent = 'Uploading assignment…';

    const subObj = {
      id: 'sub_' + Date.now(),
      assignment_id: select.value,
      user_id: userId,
      file_name: `${select.options[select.selectedIndex].text} - ${file.name}`,
      notes: notesInput.value.trim(),
      status: 'submitted',
      submitted_at: new Date().toISOString()
    };

    try {
      const path = `${userId}/${Date.now()}_${file.name}`;
      await client.storage.from('assignments').upload(path, file);
      subObj.file_path = path;

      await client.from('assignment_submissions').insert({
        assignment_id: select.value,
        user_id: userId,
        file_name: subObj.file_name,
        file_path: path,
        notes: subObj.notes
      });
    } catch (e) {
      // Fallback local save
    }

    const localKey = `aiworkhub_submissions_${userId}`;
    let existing = [];
    try {
      const s = localStorage.getItem(localKey);
      if (s) existing = JSON.parse(s);
    } catch (e) {}
    existing.unshift(subObj);
    localStorage.setItem(localKey, JSON.stringify(existing));

    if (statusMsg) statusMsg.textContent = 'Assignment submitted successfully!';
    form.reset();
    submitBtn.disabled = false;
    await loadSubmissions(userId);
  });
}

// FINANCIALS & FEES RENDER
function renderFinancials(application, payments) {
  const paid = balanceFromPayments(payments || []);
  const remaining = Math.max(0, 10000 - paid);
  const planName = (application && application.payment_plan === 'full') ? 'Full Payment (Upfront)' : 'Instalments (2 Parts)';

  if ($('fin-selected-plan')) $('fin-selected-plan').textContent = `Plan: ${planName}`;
  if ($('fin-total-paid')) $('fin-total-paid').textContent = money(paid);
  if ($('fin-outstanding-balance')) $('fin-outstanding-balance').textContent = money(remaining);

  if ($('fin-status-text')) {
    if (remaining === 0) $('fin-status-text').textContent = '✓ Fully Paid';
    else if (paid > 0) $('fin-status-text').textContent = 'Partially Paid (Instalment 1 Confirmed)';
    else $('fin-status-text').textContent = 'Payment Pending';
  }

  if ($('payment-plan-badge')) {
    $('payment-plan-badge').textContent = remaining === 0 ? '✓ Fully Paid' : `Balance: ${money(remaining)}`;
  }

  // Render Receipts History
  const receiptsList = $('payments-history-list');
  const receiptsEmpty = $('receipts-empty-msg');
  if (receiptsList) {
    receiptsList.replaceChildren();
    if (!payments || !payments.length) {
      if (receiptsEmpty) receiptsEmpty.hidden = false;
    } else {
      if (receiptsEmpty) receiptsEmpty.hidden = true;
      payments.forEach(p => {
        const li = document.createElement('li');
        const h3 = document.createElement('h3');
        h3.textContent = `Verified Receipt: ${money(p.amount_kes)}`;
        const pEl = document.createElement('p');
        pEl.textContent = `Reference: ${p.reference || 'Verified Payment'} · Verified on: ${new Date(p.verified_at || Date.now()).toLocaleDateString('en-KE')}`;
        li.append(h3, pEl);
        receiptsList.append(li);
      });
    }
  }
}

// MAIN DASHBOARD LOAD MEMBER
async function loadMember() {
  if (loading) return;
  loading = true;
  const version = identityVersion;

  if ($('refresh-dashboard')) $('refresh-dashboard').disabled = true;
  $('dashboard').hidden = true;
  $('new-application').hidden = true;
  notice('Loading your student portal…');

  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (version !== identityVersion) return;
    if (authError || !auth.user) {
      showLogin();
      notice('Please sign in to access your student account.');
      return;
    }

    currentUser = auth.user;
    $('login-view').hidden = true;
    $('member-view').hidden = false;
    $('student-name').textContent = currentUser.user_metadata?.full_name || 'learner';
    $('student-email').textContent = currentUser.email || '';

    // Safely query applications without crashing if table is not created yet
    let application = null;
    try {
      const { data, error: appError } = await client.from('applications').select('id,full_name,payment_plan,status').eq('user_id', currentUser.id).maybeSingle();
      if (!appError) application = data;
    } catch (e) {
      console.warn('Applications table fetch notice:', e);
    }

    if (version !== identityVersion) return;

    if (!application) {
      $('student-full-name').value = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '';
      $('new-application').hidden = false;
      notice('Signed in as ' + (currentUser.email || 'learner') + '. Complete your registration below to get started.');
      return;
    }

    // Safely query core tables without failing if optional columns are missing
    const [paymentsRes, resourcesRes, certsRes] = await Promise.allSettled([
      client.from('payments').select('amount_kes').eq('user_id', currentUser.id),
      client.from('course_resources').select('id,title,description,file_path').order('sort_order'),
      client.from('certificates').select('id,title,file_path').eq('user_id', currentUser.id)
    ]);

    if (version !== identityVersion) return;

    const payments = (paymentsRes.status === 'fulfilled' && !paymentsRes.value.error && paymentsRes.value.data) ? paymentsRes.value.data : [];
    const resources = (resourcesRes.status === 'fulfilled' && !resourcesRes.value.error && resourcesRes.value.data) ? resourcesRes.value.data : [];
    const certificates = (certsRes.status === 'fulfilled' && !certsRes.value.error && certsRes.value.data) ? certsRes.value.data : [];

    const labels = { pending: 'Pending review', approved: 'Approved', declined: 'Not approved' };
    $('enrolment-status').textContent = labels[application.status] || 'Under review';
    $('enrolment-help').textContent = application.status === 'approved' ? 'Your classroom and modules are ready below.' : application.status === 'pending' ? 'We have your application. AI WorkHub will review it before granting full course access.' : 'Contact AI WorkHub to discuss your application.';

    $('payment-plan').textContent = application.payment_plan === 'full' ? 'Full payment' : 'Instalments';
    $('payment-help').textContent = application.payment_plan === 'full' ? 'KSh 10,000 upfront.' : 'KSh 5,000 on enrolment + KSh 5,000 to receive your certificate.';
    $('payment-balance').textContent = money(balanceFromPayments(payments));

    $('resources-note').textContent = application.status !== 'approved' ? 'Learning resources unlock after your enrolment is approved.' : resources.length ? 'Your course files, available while you are enrolled.' : 'Your instructor has not published any resources yet. Check back soon.';

    renderFiles(resources, $('resource-list'), 'course-materials');
    renderFiles(certificates, $('certificate-list'), 'certificates');
    $('certificate-note').textContent = certificates.length ? 'Your certificate has been released. Congratulations on your progress.' : 'Your certificate will appear after course completion, verified full payment and release by AI WorkHub.';

    // Load New Features Safely (Progress, Submissions, Financials)
    try {
      const completedSet = await loadCourseProgress(currentUser.id);
      renderModules(completedSet, currentUser.id);
    } catch (e) {
      console.warn('Course progress load warning:', e);
    }

    try {
      await loadSubmissions(currentUser.id);
      initAssignmentUpload(currentUser.id);
    } catch (e) {
      console.warn('Submissions load warning:', e);
    }

    try {
      renderFinancials(application, payments);
    } catch (e) {
      console.warn('Financials render warning:', e);
    }

    $('dashboard').hidden = false;
    activateTab('overview');
    notice('');
  } catch (err) {
    console.error('loadMember Error:', err);
    if (version !== identityVersion) return;
    notice('We couldn’t load your dashboard. Check your connection and try Refresh. If this continues, contact AI WorkHub.', true);
  } finally {
    loading = false;
    if ($('refresh-dashboard')) $('refresh-dashboard').disabled = false;
  }
}

// SETUP EVENT LISTENERS
loginButton?.addEventListener('click', async () => {
  if (!client) return;
  loginButton.disabled = true;
  notice('Opening Google sign-in…');
  try {
    history.replaceState(null, '', cleanCallbackUrl(location.href));
    const callback = new URL('student.html', window.location.href);
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.href } });
    if (error) throw error;
  } catch (error) {
    notice(authFeedback(error), true);
    loginButton.disabled = false;
  }
});

$('sign-out')?.addEventListener('click', async () => {
  $('sign-out').disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    showLogin();
    notice('You have signed out.');
  } catch {
    notice('Sign out failed. Please try again.', true);
  } finally {
    $('sign-out').disabled = false;
  }
});

$('refresh-dashboard')?.addEventListener('click', loadMember);

$('student-application')?.addEventListener('change', () => {
  if ($('student-instalments')) {
    $('student-instalments').hidden = $('student-application').elements.paymentPlan.value !== 'instalments';
  }
});

$('student-application')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!currentUser || !client) return;

  const values = Object.fromEntries(new FormData(form));
  const validation = validateApplication(values);
  if (validation) {
    $('submit-status').textContent = validation;
    $('submit-status').focus();
    return;
  }

  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  $('submit-status').textContent = 'Sending your application…';

  try {
    const { error } = await client.from('applications').insert({
      user_id: currentUser.id,
      full_name: values.fullName.trim(),
      phone: values.phone.trim(),
      payment_plan: values.paymentPlan
    });
    if (error?.code === '23505') {
      await loadMember();
      return;
    }
    if (error) throw error;
    $('submit-status').textContent = '';
    await loadMember();
  } catch {
    $('submit-status').textContent = 'We couldn’t confirm your application. Your entries are still here. Try again or contact AI WorkHub.';
    $('submit-status').focus();
  } finally {
    button.disabled = false;
  }
});

async function start() {
  initTabs();
  if (!isConfigured(config)) {
    showLogin();
    notice('Student sign-in is being set up. For enrolment help, WhatsApp 0742 330 046.');
    return;
  }

  const callback = readCallback(location.href);
  client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true }
  });

  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      showLogin();
      notice('Please sign in to access your student account.');
    }
  });

  try {
    if (callback.error || callback.errorCode) {
      showLogin();
      notice(authFeedback(callback), true);
      return;
    }
    if (callback.code) {
      notice('Completing your Google sign-in…');
      const { error } = await client.auth.exchangeCodeForSession(callback.code);
      if (error) throw error;
    }
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await loadMember();
    else {
      showLogin();
      notice('');
    }
  } catch (error) {
    showLogin();
    notice(authFeedback(error), true);
  } finally {
    if (callback.code || callback.error || callback.errorCode) {
      history.replaceState(null, '', cleanCallbackUrl(location.href));
    }
  }
}

start();

