// Deploy server-side only. Secrets never belong in portal-config.js or GitHub.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const site = Deno.env.get('SITE_ORIGIN') || 'https://saintm254.github.io';
const headers = {'Access-Control-Allow-Origin':site,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
const escape=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
Deno.serve(async request=>{
 if(request.headers.get('origin') && request.headers.get('origin')!==site)return reply(403,{code:'origin_not_allowed'});
 if(request.method==='OPTIONS')return new Response(null,{headers});
 if(request.method!=='POST')return reply(405,{code:'method_not_allowed'});
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)return reply(401,{code:'sign_in_required'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user)return reply(401,{code:'sign_in_required'});
 const {data:admin,error:roleError}=await db.from('app_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle();
 if(roleError||!admin)return reply(403,{code:'admin_required'});
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('ADMISSIONS_FROM');
 if(!key||!from)return reply(503,{code:'email_not_configured'});
 let letterId:string;
 try{const body=await request.json();letterId=body.letterId;if(typeof letterId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(letterId))throw new Error();}catch{return reply(400,{code:'invalid_request'});}
 const {data:letter,error:letterError}=await db.from('admission_letters').select('id,application_id,user_id,file_path,email_status').eq('id',letterId).single();
 if(letterError||!letter)return reply(404,{code:'letter_not_found'});
 const {data:application,error:appError}=await db.from('applications').select('status,admission_no,full_name').eq('id',letter.application_id).single();
 if(appError||application?.status!=='approved'||!application?.admission_no)return reply(409,{code:'admission_not_approved'});
 const {data:student,error:studentError}=await db.auth.admin.getUserById(letter.user_id);
 if(studentError||!student.user?.email||!student.user.email_confirmed_at)return reply(409,{code:'verified_email_required'});
 // Recipient and PDF are resolved server-side; the browser cannot supply either.
 const {data:file,error:fileError}=await db.storage.from('admission-letters').download(letter.file_path);
 if(fileError||!file||file.size>5*1024*1024)return reply(409,{code:'pdf_unavailable'});
 if(letter.email_status==='sent')return reply(200,{accepted:true,alreadySent:true});
 const {data:claim,error:claimError}=await db.from('admission_letters').update({email_status:'sending',email_attempt_at:new Date().toISOString()}).eq('id',letterId).in('email_status',['not_sent','failed']).select('id').maybeSingle();
 if(claimError||!claim)return reply(409,{code:letter.email_status==='uncertain'?'delivery_uncertain':'already_processing'});
 try{
   const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`admission-letter-${letterId}`},signal:AbortSignal.timeout(20000),body:JSON.stringify({from,to:[student.user.email],subject:`AI WorkHub admission — ${application.admission_no}`,html:`<p>Dear ${escape(application.full_name)},</p><p>Your admission to AI Essentials &amp; Automation has been approved.</p><p>Admission number: <strong>${escape(application.admission_no)}</strong></p><p>Your A4 admission letter is attached. Please review its cohort details and next steps.</p><p>Visit your <a href="https://saintm254.github.io/AI-WorkHub/student.html">student portal</a> or contact AI WorkHub on WhatsApp at 0742 330 046.</p>`,attachments:[{filename:`${application.admission_no.replaceAll('/','-')}.pdf`,content:btoa(binary)}]})});
   if(!response.ok){await db.from('admission_letters').update({email_status:response.status>=500?'uncertain':'failed'}).eq('id',letterId);return reply(502,{code:response.status>=500?'delivery_uncertain':'provider_rejected'});}
   const result=await response.json();
   if(!result.id)throw new Error('No delivery reference');
   const {error:saveError}=await db.from('admission_letters').update({email_status:'sent',email_provider_id:result.id,email_sent_at:new Date().toISOString()}).eq('id',letterId);
   if(saveError)throw saveError;
   return reply(200,{accepted:true});
 }catch{
   await db.from('admission_letters').update({email_status:'uncertain'}).eq('id',letterId);
   return reply(502,{code:'delivery_uncertain'});
 }
});
