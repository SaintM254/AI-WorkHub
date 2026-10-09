// Passwords are sent only to Supabase Auth. They are never stored by our forms,
// added to URLs, logged, or written into the public student tables.
export function emailError(error = {}) {
  const messages = {
    invalid_credentials: 'The email or password is incorrect. Try again or reset your password.',
    email_not_confirmed: 'Please confirm your email first. You can resend the confirmation below.',
    email_provider_disabled: 'Email sign-in is not enabled yet. Please use Google or contact AI WorkHub.',
    signup_disabled: 'New accounts are not open yet. Contact AI WorkHub.',
    weak_password: 'Choose a stronger password that meets the security requirements.',
    same_password: 'Choose a password different from your current password.',
    over_email_send_rate_limit: 'Too many emails have been requested. Please wait a few minutes and try again.',
    over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
    email_address_invalid: 'Enter a valid email address.',
    email_address_not_authorized: 'Email delivery is not configured for students yet. Please contact AI WorkHub.',
    otp_expired: 'This email link has expired or was already used. Request a fresh link.',
    user_already_exists: 'If you already have an account, sign in or use Forgot password.',
    captcha_failed: 'The security check could not be completed. Please try again or contact AI WorkHub.'
  };
  if (error.name === 'TypeError' || error.name === 'AuthRetryableFetchError') return 'Could not connect. Check your internet connection and try again.';
  return messages[error.code] || 'The request could not be completed. Please try again or contact AI WorkHub.';
}
export function studentRedirect(href, recovery = false) {
  const url = new URL('student.html', href);
  if (recovery) url.searchParams.set('flow', 'recovery');
  return url.href;
}
export function initEmailAuth({ client, onSignedIn, onRecoveryFinished }) {
  const $ = id => document.getElementById(id);
  const form = $('email-auth-form');
  let mode = 'signin', busy = false, sentAt = 0;
  const tell = text => { $('email-auth-status').textContent = text; };
  function setMode(next) {
    if (busy) return;
    mode = next;
    $('email-password').value = '';
    $('email-password').type = 'password';
    $('toggle-email-password').textContent = 'Show';
    $('toggle-email-password').setAttribute('aria-label', 'Show password');
    $('email-password-field').hidden = mode === 'recover';
    $('email-password').required = mode !== 'recover';
    $('email-password').minLength = mode === 'signup' ? 8 : 1;
    $('email-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('email-password-hint').hidden = mode !== 'signup';
    $('email-submit').textContent = mode === 'signup' ? 'Create account' : mode === 'recover' ? 'Send reset link' : 'Sign in with email';
    $('email-signin-tab').setAttribute('aria-pressed', String(mode === 'signin'));
    $('email-signup-tab').setAttribute('aria-pressed', String(mode === 'signup'));
    $('email-form-title').textContent = mode === 'recover' ? 'Reset your password' : mode === 'signup' ? 'Create your student account' : 'Sign in with email';
    $('email-forgot').hidden = mode !== 'signin';
    $('email-back').hidden = mode !== 'recover';
    tell('');
  }
  async function run(action) {
    if (busy || !client) return;
    busy = true;
    const buttons = [...form.querySelectorAll('button'), $('email-signin-tab'), $('email-signup-tab'), $('google-login')];
    buttons.forEach(button => button.disabled = true);
    try { await action(); } catch (error) { tell(emailError(error)); }
    finally { busy = false; buttons.forEach(button => button.disabled = false); }
  }
  function canSend() {
    if (Date.now() - sentAt < 60000) { tell('Please wait one minute before requesting another email.'); return false; }
    return true;
  }
  $('email-signin-tab').onclick = () => setMode('signin');
  $('email-signup-tab').onclick = () => setMode('signup');
  $('email-forgot').onclick = () => setMode('recover');
  $('email-back').onclick = () => setMode('signin');
  $('toggle-email-password').onclick = () => {
    const show = $('email-password').type === 'password';
    $('email-password').type = show ? 'text' : 'password';
    $('toggle-email-password').textContent = show ? 'Hide' : 'Show';
    $('toggle-email-password').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  };
  $('email-resend').onclick = () => {
    if (!$('email-address').reportValidity() || !canSend()) return;
    run(async () => {
      sentAt = Date.now();
      const { error } = await client.auth.resend({ type: 'signup', email: $('email-address').value.trim(), options: { emailRedirectTo: studentRedirect(location.href) } });
      if (error) throw error;
      tell('If this address has an unconfirmed account, a new confirmation email has been requested. Check your inbox and spam folder.');
    });
  };
  form.onsubmit = event => {
    event.preventDefault();
    if (!form.reportValidity() || (mode !== 'signin' && !canSend())) return;
    run(async () => {
      const email = $('email-address').value.trim();
      const password = $('email-password').value;
      tell(mode === 'signin' ? 'Signing in…' : 'Sending your request…');
      if (mode === 'signin') {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        $('email-password').value = '';
        tell('');
        await onSignedIn();
      } else if (mode === 'signup') {
        sentAt = Date.now();
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: studentRedirect(location.href) } });
        if (error) throw error;
        $('email-password').value = '';
        if (data.session) { tell(''); await onSignedIn(); }
        else tell('Check your email for a confirmation link, including your spam folder. If you already have an account, sign in or reset your password.');
      } else {
        sentAt = Date.now();
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: studentRedirect(location.href, true) });
        if (error) throw error;
        tell('If an account exists for this address, a password reset email has been requested. Open the newest link in this same browser.');
      }
    });
  };
  $('recovery-form').onsubmit = async event => {
    event.preventDefault();
    if (busy || !client) return;
    const password = $('new-password').value;
    $('confirm-password').setCustomValidity(password === $('confirm-password').value ? '' : 'The passwords must match.');
    if (!event.currentTarget.reportValidity()) return;
    busy = true; $('save-password').disabled = true;
    try {
      $('recovery-status').textContent = 'Updating your password…';
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      $('recovery-form').reset();
      $('recovery-status').textContent = '';
      const url = new URL(location.href); url.searchParams.delete('flow');
      history.replaceState(null, '', url.pathname + url.search);
      $('recovery-view').hidden = true;
      await onRecoveryFinished();
    } catch (error) { $('recovery-status').textContent = emailError(error); }
    finally { busy = false; $('save-password').disabled = false; }
  };
  $('confirm-password').oninput = () => $('confirm-password').setCustomValidity('');
  $('new-password').oninput = () => $('confirm-password').setCustomValidity('');
  $('recovery-cancel').onclick = async () => {
    if (busy) return;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) { $('recovery-status').textContent = emailError(error); return; }
    const url = new URL(location.href); url.searchParams.delete('flow');
    history.replaceState(null, '', url.pathname + url.search);
    $('recovery-view').hidden = true;
    $('login-view').hidden = false;
    $('recovery-form').reset();
    setMode('recover');
  };
  setMode('signin');
  form.querySelectorAll('input,button').forEach(element => element.disabled = !client);
  $('email-signin-tab').disabled = $('email-signup-tab').disabled = !client;
}
