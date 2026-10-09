import { readCallback, authFeedback, cleanCallbackUrl } from './auth-feedback.js';
import { createClient } from '@supabase/supabase-js';
import { validateApplication, isConfigured, balanceFromPayments, paymentTotals, validateUpload } from './validation.js';

const $ = id => document.getElementById(id);
const setElemText = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
};

const config = window.AI_WORKHUB_CONFIG;
const loginButton = $('google-login');

let client;
let currentUser;
let loading = false;
let identityVersion = 0;
let currentApplication = null;
let assignmentOptions = [];

const money = amount => `KSh ${Number(amount).toLocaleString('en-KE')}`;

function notice(text, error = false) {
  const el = $('portal-status');
  if (el) {
    el.textContent = text;
    el.classList.toggle('error', error);
    if (!text) el.hidden = true;
    else el.hidden = false;
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

// PORTAL MOBILE NAV
function initPortalMobileNav() {
  const toggle = document.querySelector('.portal-menu-toggle');
  const nav = document.getElementById('portal-mobile-nav');
  const closeBtn = nav && nav.querySelector('.portal-menu-close');
  if (!toggle || !nav) return;

  function openPortalMenu() {
    nav.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close navigation');
    document.body.classList.add('portal-menu-open');
    document.querySelector('main').inert=true;
    closeBtn && closeBtn.focus();
  }

  function closePortalMenu(restoreFocus = false) {
    const wasOpen = nav.classList.contains('open');
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    document.body.classList.remove('portal-menu-open');
    document.querySelector('main').inert=false;
    if (restoreFocus && wasOpen) toggle.focus();
  }

  window.matchMedia('(max-width:800px)').addEventListener('change',()=>closePortalMenu(true));
  toggle.addEventListener('click', () => {
    if (nav.classList.contains('open')) closePortalMenu(true);
    else openPortalMenu();
  });

  closeBtn && closeBtn.addEventListener('click', () => closePortalMenu(true));

  // Mobile tab buttons inside overlay
  nav.querySelectorAll('.portal-mobile-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      closePortalMenu();
      activateTab(target);
    });
  });

  document.addEventListener('keydown', event => {
    if (!nav.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closePortalMenu(true); }
    if (event.key === 'Tab') {
      const items = [toggle, ...nav.querySelectorAll('button, a')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}


// SHOW LOGIN VIEW
function showLogin() {
  identityVersion += 1;
  currentUser = null;
  currentApplication = null;
  assignmentOptions = [];
  for (const id of ['modules-list','submissions-list','payments-history-list','admission-letter-list']) $(id)?.replaceChildren();
  if ($('assignment-upload-form')) $('assignment-upload-form').reset();
  document.querySelector('.portal-menu-toggle')?.setAttribute('hidden', '');
  document.getElementById('portal-mobile-nav')?.classList.remove('open');
  document.body.classList.remove('portal-menu-open');
  document.querySelector('main').inert=false;
  if ($('member-view')) $('member-view').hidden = true;
  if ($('dashboard')) $('dashboard').hidden = true;
  if ($('new-application')) $('new-application').hidden = true;
  setElemText('student-name', '');
  setElemText('student-email', '');
  if ($('resource-list')) $('resource-list').replaceChildren();
  if ($('certificate-list')) $('certificate-list').replaceChildren();
  if ($('student-application')) $('student-application').reset();
  setElemText('submit-status', '');
  if ($('student-instalments')) $('student-instalments').hidden = true;
  if ($('login-view')) $('login-view').hidden = false;
  if (loginButton) loginButton.disabled = !client;
}

// PRIVATE FILE DOWNLOAD / OPEN
async function openPrivateFile(bucket, path, button) {
  if (button) button.disabled = true;
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
    if (button) button.disabled = false;
  }
}

function renderFiles(items, container, bucket) {
  if (!container) return;
  container.replaceChildren();
  for (const item of (items || [])) {
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
  const {data,error}=await client.from('course_progress').select('module_id,completed').eq('user_id',userId);
  if(error) throw error;
  return new Set((data || []).filter(x=>x.completed && COURSE_MODULES.some(m=>m.id===x.module_id)).map(x=>x.module_id));
}
async function saveModuleToggle(userId,moduleId,completed) {
  const {error}=await client.from('course_progress').upsert({user_id:userId,module_id:moduleId,completed},{onConflict:'user_id,module_id'});
  if(error) throw error;
}
function renderModules(completedSet, userId) {
  const container = $('modules-list');
  if (!container) return;
  container.replaceChildren();

  const total = COURSE_MODULES.length;
  const completedCount = completedSet.size;
  const percentage = Math.round((completedCount / total) * 100);

  setElemText('overview-progress-text', `${percentage}%`);
  if ($('overview-progress-bar')) $('overview-progress-bar').style.width = `${percentage}%`;
  setElemText('overview-progress-sub', `${completedCount} of ${total} modules completed`);
  setElemText('progress-percentage-large', `${percentage}%`);
  if ($('main-progress-bar-fill')) $('main-progress-bar-fill').style.width = `${percentage}%`;

  COURSE_MODULES.forEach((mod) => {
    const isCompleted = completedSet.has(mod.id);
    const card = document.createElement('div');
    card.className = 'module-card';

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
    toggleBtn.textContent = isCompleted ? 'Completed ↗' : 'Mark as completed';
    toggleBtn.addEventListener('click', async () => {
      toggleBtn.disabled = true;
      const nextState = !completedSet.has(mod.id);
      const version=identityVersion;
      try {
        await saveModuleToggle(userId, mod.id, nextState);
        if(version!==identityVersion) return;
        if (nextState) completedSet.add(mod.id); else completedSet.delete(mod.id);
        renderModules(completedSet, userId);
      } catch { notice('Progress could not be saved. Please try again; no completion change was recorded.',true); }
      finally { toggleBtn.disabled=false; }
    });

    toggleBtn.disabled=currentApplication?.status!=='approved';
    actionRow.append(document.createElement('span'), toggleBtn);

    card.append(top, topicUl, actionRow);
    container.append(card);
  });
}

// ASSIGNMENTS MANAGEMENT
async function loadSubmissions(userId) {
  const version=identityVersion;
  const {data,error}=await client.from('assignment_submissions').select('id,file_name,notes,status,submitted_at').eq('user_id',userId).order('submitted_at',{ascending:false});
  if(error) throw error;
  if(version!==identityVersion) return;
  const container=$('submissions-list'); container.replaceChildren();
  $('submissions-empty-msg').hidden=!!data.length;
  $('submissions-empty-msg').textContent='No assignments uploaded yet.';
  for(const sub of data){
    const li=document.createElement('li'),h=document.createElement('h3'),p=document.createElement('p');
    h.textContent=sub.file_name;
    p.textContent=`Submitted: ${new Date(sub.submitted_at).toLocaleDateString('en-KE')} · Status: ${sub.status}${sub.notes?' · '+sub.notes:''}`;
    li.append(h,p);container.append(li);
  }
}
async function loadAssignments() {
  const version=identityVersion;
  const {data,error}=await client.from('assignments').select('id,title').order('sort_order');
  if(error) throw error;
  if(version!==identityVersion) return;
  assignmentOptions=data||[];
  const select=$('assignment-select');select.replaceChildren();
  for(const item of assignmentOptions){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.title;select.append(opt);}
  const enabled=currentApplication?.status==='approved' && assignmentOptions.length>0;
  $('submit-assignment-btn').disabled=!enabled;
  $('assignment-file').disabled=!enabled;
  select.disabled=!enabled;
  $('upload-status-msg').textContent=enabled?'':currentApplication?.status==='approved'?'No assignments published yet.':'Assignments unlock after admission approval.';
}
function initAssignmentUpload() {
  // Register once, using the current authenticated identity on every submission.
  $('assignment-upload-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=$('submit-assignment-btn'),status=$('upload-status-msg');
    if(button.disabled || !currentUser || currentApplication?.status!=='approved') return;
    const file=$('assignment-file').files[0],assignmentId=$('assignment-select').value,notes=$('assignment-notes').value.trim();
    const problem=validateUpload(file,notes);
    if(problem){status.textContent=problem;return;}
    if(!assignmentOptions.some(a=>a.id===assignmentId)){status.textContent='Choose a published assignment.';return;}
    const version=identityVersion,userId=currentUser.id;
    const extension=file.name.split('.').pop().toLowerCase();
    const path=`${userId}/${crypto.randomUUID()}.${extension}`;
    button.disabled=true;status.textContent='Uploading assignment…';
    let uploaded=false,recorded=false;
    try {
      const {error:uploadError}=await client.storage.from('assignments').upload(path,file,{contentType:file.type || 'application/octet-stream',upsert:false});
      if(uploadError) throw uploadError;
      uploaded=true;
      const {error}=await client.from('assignment_submissions').insert({assignment_id:assignmentId,user_id:userId,file_name:file.name,file_path:path,notes});
      if(error) throw error;
      recorded=true;
      if(version!==identityVersion) return;
      form.reset();status.textContent='Assignment submitted successfully.';
      try {await loadSubmissions(userId);} catch {status.textContent='Assignment saved, but history could not refresh. Use Refresh to try again.';}
    } catch {
      if(uploaded&&!recorded) await client.storage.from('assignments').remove([path]).catch(()=>{});
      if(version===identityVersion) status.textContent='Submission could not be confirmed. Your file selection is preserved. Refresh your history before retrying.';
    } finally {if(version===identityVersion) button.disabled=false;}
  });
}

// FINANCIALS & FEES RENDER
function renderFinancials(application, payments) {
  const {paid,remaining} = paymentTotals(payments || []);
  const planName = (application && application.payment_plan === 'full') ? 'Full Payment (Upfront)' : 'Instalments (2 Parts)';

  setElemText('fin-selected-plan', `Plan: ${planName}`);
  setElemText('fin-total-paid', money(paid));
  setElemText('fin-outstanding-balance', money(remaining));

  if ($('fin-status-text')) {
    if (remaining === 0) $('fin-status-text').textContent = 'Fully Paid';
    else if (paid > 0) $('fin-status-text').textContent = 'Partially Paid';
    else $('fin-status-text').textContent = 'Payment Pending';
  }

  if ($('payment-plan-badge')) {
    $('payment-plan-badge').textContent = remaining === 0 ? 'Fully Paid' : `Balance: ${money(remaining)}`;
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
  if ($('dashboard')) $('dashboard').hidden = true;
  if ($('new-application')) $('new-application').hidden = true;
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
    if ($('login-view')) $('login-view').hidden = true;
    if ($('member-view')) $('member-view').hidden = false;
    setElemText('student-name', currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'learner');
    setElemText('student-email', currentUser.email || '');

    // Safely query applications without crashing if table is not created yet
    let application = null;
    try {
      const { data, error: appError } = await client.from('applications').select('id,full_name,payment_plan,status').eq('user_id', currentUser.id).maybeSingle();
      if(appError) throw appError;
      application = data;
    } catch (e) {
      throw e;
    }

    if (version !== identityVersion) return;

    currentApplication=application;
    document.querySelector('.portal-menu-toggle')?.toggleAttribute('hidden',!application);
    setElemText('student-admission', application?.admission_no ? `Admission no. ${application.admission_no}` : '');
    if (!application) {
      if ($('student-full-name')) $('student-full-name').value = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '';
      if ($('new-application')) $('new-application').hidden = false;
      notice('Signed in as ' + (currentUser.email || 'learner') + '. Welcome! Complete your enrolment below.');
      return;
    }

    const results=await Promise.all([
      client.from('payments').select('amount_kes,reference,verified_at').eq('user_id',currentUser.id),
      client.from('course_resources').select('id,title,description,file_path').order('sort_order'),
      client.from('certificates').select('id,title,file_path').eq('user_id',currentUser.id),
      client.from('admission_letters').select('id,file_path,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}),
      client.from('applications').select('admission_no').eq('id',application.id).single()
    ]);
    if(version!==identityVersion) return;
    if(results.slice(0,3).some(r=>r.error)) throw results.slice(0,3).find(r=>r.error).error;
    const warnings=[];
    // Keep existing student records usable while the owner installs the new schema.
    const migrationErrors=['42703','42P01','PGRST204','PGRST205'];
    for(const result of results.slice(3)) {
      if(result.error && !migrationErrors.includes(result.error.code)) throw result.error;
    }
    if(results.slice(3).some(r=>r.error)) warnings.push('Admission letters are awaiting a database update by AI WorkHub.');
    const [payments,resources,certificates,letters]=results.slice(0,4).map(r=>r.data||[]);
    setElemText('student-admission',results[4].data?.admission_no?`Admission no. ${results[4].data.admission_no}`:'');
    renderFiles(letters.map((l,i)=>({...l,title:`Admission letter${i===0?' (latest)':''}`})), $('admission-letter-list'),'admission-letters');
    const labels = { pending: 'Pending review', approved: 'Approved', declined: 'Not approved' };
    setElemText('enrolment-status', labels[application.status] || 'Under review');
    setElemText('enrolment-help', application.status === 'approved' ? 'Your classroom and modules are ready below.' : application.status === 'pending' ? 'We have your application. AI WorkHub will review it before granting full course access.' : 'Contact AI WorkHub to discuss your application.');

    setElemText('payment-plan', application.payment_plan === 'full' ? 'Full payment' : 'Instalments');
    setElemText('payment-help', application.payment_plan === 'full' ? 'KSh 10,000 upfront.' : 'KSh 5,000 on enrolment + KSh 5,000 to receive your certificate.');
    setElemText('payment-balance', money(balanceFromPayments(payments)));

    setElemText('resources-note', application.status !== 'approved' ? 'Learning resources unlock after your enrolment is approved.' : resources.length ? 'Your course files, available while you are enrolled.' : 'Your instructor has not published any resources yet. Check back soon.');

    renderFiles(resources, $('resource-list'), 'course-materials');
    renderFiles(certificates, $('certificate-list'), 'certificates');
    setElemText('certificate-note', certificates.length ? 'Your certificate has been released. Congratulations on your progress.' : 'Your certificate will appear after course completion, verified full payment and release by AI WorkHub.');

    try {
      const completedSet=await loadCourseProgress(currentUser.id);
      if(version!==identityVersion) return;
      renderModules(completedSet,currentUser.id);
    } catch {
      $('modules-list').replaceChildren();
      for(const id of ['overview-progress-text','progress-percentage-large'])setElemText(id,'Unavailable');
      setElemText('overview-progress-sub','Progress could not be loaded.');
      for(const id of ['overview-progress-bar','main-progress-bar-fill'])if($(id))$(id).style.width='0%';
      warnings.push('Course progress could not be loaded.');
    }
    if(version!==identityVersion) return;
    try {await loadSubmissions(currentUser.id);} catch {
      $('submissions-list').replaceChildren();$('submissions-empty-msg').hidden=false;
      $('submissions-empty-msg').textContent='Submission history could not be loaded.';
      warnings.push('Submission history could not be loaded.');
    }
    if(version!==identityVersion) return;
    $('submit-assignment-btn').disabled=true;
    try {await loadAssignments();} catch {warnings.push('Assignments are unavailable until database setup or connectivity is restored.');}
    if(version!==identityVersion) return;
    renderFinancials(application,payments);
    if ($('dashboard')) $('dashboard').hidden = false;
    activateTab('overview');
    notice(warnings.join(' '),warnings.length>0);
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
  if ($('sign-out')) $('sign-out').disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    showLogin();
    notice('You have signed out.');
  } catch {
    notice('Sign out failed. Please try again.', true);
  } finally {
    if ($('sign-out')) $('sign-out').disabled = false;
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
    setElemText('submit-status', validation);
    if ($('submit-status')) $('submit-status').focus();
    return;
  }

  const button = form.querySelector('[type=submit]');
  if (button) button.disabled = true;
  setElemText('submit-status', 'Sending your application…');

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
    setElemText('submit-status', '');
    await loadMember();
  } catch {
    setElemText('submit-status', 'We couldn’t confirm your application. Your entries are still here. Try again or contact AI WorkHub.');
    if ($('submit-status')) $('submit-status').focus();
  } finally {
    if (button) button.disabled = false;
  }
});

async function start() {
  initTabs();
  initAssignmentUpload();
  initPortalMobileNav();
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
