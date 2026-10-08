import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateApplication, isConfigured, balanceFromPayments } from '../src/validation.js';
const valid = {fullName:'Amina Wanjiku',phone:'+254 742 330 046',paymentPlan:'instalments'};
test('application accepts Kenyan number and both payment plans', () => {
  assert.equal(validateApplication(valid),'');
  assert.equal(validateApplication({...valid,phone:'0742330046',paymentPlan:'full'}),'');
});
test('blank name, invalid phone and unsupported payment plan are rejected', () => {
  for(const invalid of [{fullName:'   '},{phone:'abc'},{phone:'123'},{phone:'1234567890123456'},{paymentPlan:'paid'},{fullName:'x'.repeat(121)}]) assert.ok(validateApplication({...valid,...invalid}));
});
test('configuration refuses secret keys, missing config and non-HTTPS endpoints', () => {
  assert.equal(isConfigured({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_example'}),true);
  for(const c of [{},{supabaseUrl:'https://example.supabase.co/rest/v1/',supabasePublishableKey:'sb_publishable_example'},{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_secret_example'},{supabaseUrl:'http://example.supabase.co',supabasePublishableKey:'sb_publishable_example'}]) assert.equal(isConfigured(c),false);
});
test('balance uses verified payment rows, never selected instalment plan', () => {
  assert.equal(balanceFromPayments([]),10000);
  assert.equal(balanceFromPayments([{amount_kes:5000}]),5000);
  assert.equal(balanceFromPayments([{amount_kes:5000},{amount_kes:5000}]),0);
  assert.equal(balanceFromPayments([{amount_kes:12000}]),0);
});
test('page links use existing static files and auth destination stays under repo path', () => {
  assert.equal(new URL('student.html','https://saintm254.github.io/AI-WorkHub/index.html').href,'https://saintm254.github.io/AI-WorkHub/student.html');
  for(const file of ['index.html','student.html','privacy.html']) {
    const html=readFileSync(file,'utf8');
    for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const path=match[1].split('?')[0];
      if(!/^https?:/.test(path) && !path.startsWith('dist/')) assert.ok(existsSync(path),path);
    }
  }
});
test('schema defines RLS on every student table and forbids browser approval/payment writes', () => {
  const sql=readFileSync('supabase/schema.sql','utf8');
  for(const table of ['applications','payments','course_resources','certificates']) assert.ok(sql.includes(`alter table public.${table} enable row level security`));
  assert.ok(sql.includes('grant insert (user_id,full_name,phone,payment_plan)'));
  assert.ok(!/grant\s+(?:update|delete|all)/i.test(sql));
  assert.ok(sql.includes('coalesce(sum(p.amount_kes),0)'));
  assert.ok(sql.includes("status = 'approved'"));
});
