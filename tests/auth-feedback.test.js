import test from 'node:test';
import assert from 'node:assert/strict';
import { readCallback, authFeedback, cleanCallbackUrl } from '../src/auth-feedback.js';
test('reads Supabase callback errors from hash and query', () => {
  for(const separator of ['?','#']) {
    const result=readCallback(`https://example.org/student.html${separator}error=server_error&error_code=unexpected_failure&error_description=Unable%20to%20exchange%20external%20code`);
    assert.match(authFeedback(result), /Code: external_code_exchange_failed/);
  }
});
test('authorization code is separate from provider error', () => {
  const result=readCallback('https://example.org/student.html?code=private-code');
  assert.equal(result.code,'private-code');assert.equal(result.error,'');
});
test('missing PKCE verifier and expiry receive actionable feedback', () => {
  assert.match(authFeedback({name:'AuthPKCECodeVerifierMissingError'}), /Code: pkce_verifier_missing/);
  assert.match(authFeedback({code:'flow_state_expired'}), /expired/);
});
test('does not show arbitrary error text, tokens or unknown codes', () => {
  const result=authFeedback({errorCode:'secret-value',description:'<script> secret-token user@example.org'});
  assert.match(result,/Code: callback_failed/);
  assert.doesNotMatch(result,/secret|script|user@/);
});
test('callback cleanup removes code, state, errors and tokens but keeps unrelated query settings', () => {
  assert.equal(cleanCallbackUrl('https://example.org/AI-WorkHub/student.html?code=private-code&state=private-state&error=bad&error_description=secret&view=portal#access_token=secret'), '/AI-WorkHub/student.html?view=portal');
});
