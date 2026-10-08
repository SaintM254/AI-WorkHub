// Only show known diagnostic codes and our own explanations. Never render raw
// OAuth descriptions, callback URLs, authorization codes or provider tokens.
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
export function readCallback(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const read = key => url.searchParams.get(key) || hash.get(key) || '';
  return { code: url.searchParams.get('code'), error: read('error'), errorCode: read('error_code'), description: read('error_description') };
}
export function authFeedback(error = {}) {
  const description = String(error.description || error.message || '').toLowerCase();
  let code = error.errorCode || error.code || error.error || '';
  if (/unable to exchange external code|error exchanging code/.test(description)) code = 'external_code_exchange_failed';
  else if (/code verifier.*(empty|missing|not found)|pkce.*(empty|missing|not found)/.test(description) || error.name === 'AuthPKCECodeVerifierMissingError') code = 'pkce_verifier_missing';
  else if (error.name === 'AuthRetryableFetchError' || error.name === 'TypeError') code = 'request_failed';
  if (!Object.hasOwn(messages, code)) code = 'callback_failed';
  return `${messages[code]} (Code: ${code})`;
}
export function cleanCallbackUrl(href) {
  const url = new URL(href);
  for (const key of ['code','state','error','error_code','error_description','error_uri']) url.searchParams.delete(key);
  // Student portal has no hash navigation. Never leave OAuth credentials in it.
  url.hash = '';
  return url.pathname + url.search;
}
