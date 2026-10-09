import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const source=readFileSync('supabase/functions/send-admission-letter/index.ts','utf8').replace(/^import .*?;$/m,'');
const {code}=await transform(source,{loader:'ts',target:'es2022'});
function harness({admin=true,configured=true,providerStatus=200,throwNetwork=false}={}) {
 let handler,requestBody,mailCalls=0;
 const letter={id:'30000000-0000-4000-8000-000000000001',application_id:'application-a',user_id:'student-a',file_path:'student-a/letter.pdf',email_status:'not_sent'};
 const values={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-key',...(configured?{RESEND_API_KEY:'test-email-key',ADMISSIONS_FROM:'Admissions <admissions@example.com>'}:{})};
 const db={auth:{getUser:async token=>({data:{user:token==='valid'?{id:'admin-a'}:null}}),admin:{getUserById:async()=>({data:{user:{email:'student@example.com',email_confirmed_at:'2026-01-01'}}})}},storage:{from:()=>({download:async()=>({data:new Blob(['%PDF-test'],{type:'application/pdf'})})})},from(table){let patch=null,claim=false;const execute=()=>{if(table==='app_admins')return {data:admin?{user_id:'admin-a'}:null};if(table==='applications')return {data:{status:'approved',admission_no:'AIWH/ESS/0001/2026',full_name:'Student <A>'}};if(patch){if(claim&&!['not_sent','failed'].includes(letter.email_status))return {data:null};Object.assign(letter,patch);return {data:{id:letter.id}};}return {data:{...letter}};};const q={select(){return q},eq(){return q},in(){claim=true;return q},update(value){patch=value;return q},single(){return Promise.resolve(execute())},maybeSingle(){return Promise.resolve(execute())},then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject)}};return q;}};
 new Function('Deno','createClient','fetch',code)({env:{get:key=>values[key]},serve:fn=>handler=fn},()=>db,async(url,options)=>{mailCalls++;requestBody=JSON.parse(options.body);if(throwNetwork)throw new Error('timeout');return new Response(JSON.stringify({id:'provider-mail-1'}),{status:providerStatus});});
 return {letter,get requestBody(){return requestBody},get mailCalls(){return mailCalls},send:(token='valid')=>handler(new Request('https://example.supabase.co/functions/v1/send-admission-letter',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:'https://saintm254.github.io'},body:JSON.stringify({letterId:letter.id,to:'attacker@example.com',file_path:'other.pdf'})}))};
}
test('email rejects non-admin users and unauthenticated tokens',async()=>{
 const h=harness({admin:false});assert.equal((await h.send()).status,403);assert.equal(h.mailCalls,0);
 assert.equal((await harness().send('invalid')).status,401);
});
test('email requires provider configuration without false success',async()=>{
 const h=harness({configured:false});const r=await h.send();assert.equal(r.status,503);assert.equal((await r.json()).code,'email_not_configured');assert.equal(h.letter.email_status,'not_sent');
});
test('email resolves recipient/PDF server-side and prevents duplicate sending',async()=>{
 const h=harness();assert.equal((await h.send()).status,200);assert.deepEqual(h.requestBody.to,['student@example.com']);assert.equal(h.requestBody.attachments[0].filename,'AIWH-ESS-0001-2026.pdf');assert.ok(h.requestBody.html.includes('&lt;A&gt;'));assert.equal(h.letter.email_status,'sent');await h.send();assert.equal(h.mailCalls,1);
});
test('provider rejection and uncertain network response never claim email was sent',async()=>{
 const h=harness({providerStatus:422});assert.equal((await h.send()).status,502);assert.equal(h.letter.email_status,'failed');
 const uncertain=harness({throwNetwork:true});assert.equal((await uncertain.send()).status,502);assert.equal(uncertain.letter.email_status,'uncertain');assert.equal((await uncertain.send()).status,409);assert.equal(uncertain.mailCalls,1);
});
