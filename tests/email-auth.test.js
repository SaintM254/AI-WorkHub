import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {emailError,initEmailAuth,studentRedirect} from '../src/email-auth.js';
import {sendAdmissionEmail} from '../src/admission-email.js';
function setup(auth={}) {
 const dom=new JSDOM(readFileSync('student.html','utf8'),{url:'https://example.org/AI-WorkHub/student.html'});
 global.document=dom.window.document;global.location=dom.window.location;global.history=dom.window.history;
 let signedIn=0,recovered=0;
 initEmailAuth({client:auth===null?null:{auth},onSignedIn:async()=>signedIn++,onRecoveryFinished:async()=>recovered++});
 return {$:id=>dom.window.document.getElementById(id),dom,get signedIn(){return signedIn},get recovered(){return recovered},close(){dom.window.close();delete global.document;delete global.location;delete global.history;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('email redirects retain repo path and recovery marker, never a password or stale code',()=>{
 assert.equal(studentRedirect('https://example.org/AI-WorkHub/student.html?code=secret',true),'https://example.org/AI-WorkHub/student.html?flow=recovery');
});
test('unconfigured forms remain disabled',()=>{const h=setup(null);try{assert(h.$('email-submit').disabled);assert(h.$('email-address').disabled);}finally{h.close();}});
test('sign-up requests confirmation and clears password without claiming verified sign-in',async()=>{
 let payload;const h=setup({signUp:async value=>{payload=value;return {data:{session:null},error:null}}});
 try{h.$('email-signup-tab').click();h.$('email-address').value='learner@example.com';h.$('email-password').value='test-password-123';h.$('email-auth-form').onsubmit({preventDefault(){}});await tick();assert.equal(payload.email,'learner@example.com');assert.equal(payload.options.emailRedirectTo,'https://example.org/AI-WorkHub/student.html');assert.equal(h.$('email-password').value,'');assert.match(h.$('email-auth-status').textContent,/Check your email/);assert.equal(h.signedIn,0);}finally{h.close();}
});
test('password login handles wrong credentials and only enters portal after success',async()=>{
 let fail=true;const h=setup({signInWithPassword:async()=>({error:fail?{code:'invalid_credentials'}:null})});
 try{h.$('email-address').value='learner@example.com';h.$('email-password').value='test-password-123';h.$('email-auth-form').onsubmit({preventDefault(){}});await tick();assert.match(h.$('email-auth-status').textContent,/incorrect/);assert.equal(h.signedIn,0);fail=false;h.$('email-auth-form').onsubmit({preventDefault(){}});await tick();assert.equal(h.signedIn,1);assert.equal(h.$('email-password').value,'');}finally{h.close();}
});
test('reset email request uses recovery URL and generic anti-enumeration message',async()=>{
 let calls=0,options;const h=setup({resetPasswordForEmail:async(email,opt)=>{calls++;options=opt;return {error:null}}});
 try{h.$('email-forgot').click();assert(h.$('email-password-field').hidden);h.$('email-address').value='learner@example.com';h.$('email-auth-form').onsubmit({preventDefault(){}});await tick();assert.equal(options.redirectTo,'https://example.org/AI-WorkHub/student.html?flow=recovery');assert.match(h.$('email-auth-status').textContent,/If an account exists/);h.$('email-auth-form').onsubmit({preventDefault(){}});await tick();assert.equal(calls,1);}finally{h.close();}
});
test('confirmation resend is throttled and hides account existence',async()=>{
 let calls=0;const h=setup({resend:async()=>{calls++;return {error:null}}});
 try{h.$('email-address').value='learner@example.com';h.$('email-resend').click();await tick();assert.match(h.$('email-auth-status').textContent,/If this address/);h.$('email-resend').click();await tick();assert.equal(calls,1);}finally{h.close();}
});
test('new password must match before update; successful update returns to portal',async()=>{
 let calls=0;const h=setup({updateUser:async()=>{calls++;return {error:null}}});
 try{h.$('new-password').value='new-test-password';h.$('confirm-password').value='different-test-password';await h.$('recovery-form').onsubmit({preventDefault(){},currentTarget:h.$('recovery-form')});assert.equal(calls,0);h.$('confirm-password').value='new-test-password';await h.$('recovery-form').onsubmit({preventDefault(){},currentTarget:h.$('recovery-form')});assert.equal(calls,1);assert.equal(h.recovered,1);assert.equal(h.$('new-password').value,'');}finally{h.close();}
});
test('auth messages never expose raw provider errors or credentials',()=>{
 const message=emailError({message:'secret token / password'});assert.doesNotMatch(message,/secret|token|password/);
});
test('automatic email passes only saved letter ID and requires provider acceptance',async()=>{
 let payload;const client={functions:{invoke:async(name,options)=>{payload={name,options};return {data:{accepted:true},error:null}}}};
 await sendAdmissionEmail(client,'letter-123');assert.deepEqual(payload,{name:'send-admission-letter',options:{body:{letterId:'letter-123'}}});
 await assert.rejects(sendAdmissionEmail({functions:{invoke:async()=>({data:{accepted:false}})}},'letter-123'),/not accepted/);
 await assert.rejects(sendAdmissionEmail({functions:{invoke:async()=>({error:{context:{json:async()=>({code:'email_not_configured'})}}})}},'letter-123'),/not configured/);
});
