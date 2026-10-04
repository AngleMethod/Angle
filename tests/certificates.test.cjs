const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./certificateHarness.cjs');
const {certificateText,certificateNumber}=load('lib/certificates.ts');
const uid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const request=(body={},search='')=>({json:async()=>body,nextUrl:new URL('https://angle.coach/api/certificates'+search)});
function harness({user={id:uid,isAdmin:true},existing=null,insertError=null,pdfError=null}={}) {
 const calls=[],writes=[],rows=existing?[existing]:[];
 const db={auth:{admin:{getUserById:async()=>({data:{user:{email:'member@example.com'}}})}},from:table=>{
  const filters=[];let action='select',value;
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,limit:()=>q,is:(k,v)=>{filters.push([k,v]);return q;},
   update:v=>{action='update';value=v;return q;},insert:v=>{action='insert';value=v;return q;},
   maybeSingle:async()=>({data:rows.find(r=>filters.every(([k,v])=>r[k]===v))||null,error:null}),single:async()=>({data:rows.find(r=>filters.every(([k,v])=>r[k]===v))||null,error:null}),
   then:(resolve,reject)=>Promise.resolve().then(()=>{calls.push({table,action,filters});if(action==='insert'){writes.push(value);if(insertError)return {error:insertError};rows.push({...value,awarded_at:'2026-10-04T21:00:00Z',award_date:'2026-10-04',email_status:'sent'});}return {data:rows,error:null};}).then(resolve,reject)};return q;
 }};
 const mocks={'@/lib/certificateAuth':{certificateAuth:async()=>user,certReply:(body,status=200)=>({body,status})},'@/lib/supabase':{createAdminClient:()=>db},'@/lib/certificatePdf':{createCertificatePdf:async()=>{if(pdfError)throw new Error(pdfError);return Buffer.from('pdf');}},'@/lib/certificateEmail':{sendCertificateEmail:async id=>calls.push({email:id})}};
 return {calls,writes,rows,admin:load('app/api/admin/certificates/route.ts',mocks),member:load('app/api/certificates/route.ts',mocks),pdf:load('app/api/certificates/[id]/pdf/route.ts',mocks)};
}
test('certificate text validates length and prevents hidden/control characters',()=>{
 assert.equal(certificateText(' Nina Grishchenko ',80),'Nina Grishchenko');
 for(const v of [null,{},'', 'a'.repeat(81),'Josh\nLee','Josh\u202eLee'])assert.equal(certificateText(v,80),null);
 assert.equal(certificateNumber(id),'ANG-222222222222');
});
test('only signed-in coaches may award or retry email',async()=>{
 for(const [user,status] of [[null,401],[{id:uid,isAdmin:false},403]]){const h=harness({user});assert.equal((await h.admin.POST(request())).status,status);assert.equal((await h.admin.PATCH(request({id}))).status,status);assert.equal(h.calls.length,0);}
});
test('members cannot list another member’s certificates',async()=>{const h=harness({user:{id:uid,isAdmin:false}});assert.equal((await h.member.GET(request({},'?userId='+id))).status,403);assert.equal(h.calls.length,0);});
test('PDF lookup is constrained to the authenticated member',async()=>{const h=harness({user:{id:uid,isAdmin:false},existing:{id,user_id:id}});assert.equal((await h.pdf.GET(request(),{params:Promise.resolve({id})})).status,404);});
test('award ignores client date and email; recipient comes from auth directory',async()=>{
 const h=harness();const res=await h.admin.POST(request({id,userId:uid,name:'Nina',skill:'Candle One-Arm Handstand',date:'1999-01-01',award_date:'1999-01-01',email:'attacker@example.com'}));
 assert.equal(res.status,200);assert.equal(h.writes.length,1);assert.deepEqual(h.writes[0],{id,user_id:uid,recipient_name:'Nina',recipient_email:'member@example.com',skill:'Candle One-Arm Handstand',awarded_by:uid});assert.equal(res.body.certificate.award_date,'2026-10-04');
});
test('retrying the exact award does not insert a second certificate',async()=>{const h=harness({existing:{id,user_id:uid,recipient_name:'Nina',skill:'Press'}});assert.equal((await h.admin.POST(request({id,userId:uid,name:'Nina',skill:'Press'}))).status,200);assert.equal(h.writes.length,0);});
test('reusing an award id for different content is rejected before email',async()=>{const h=harness({existing:{id,user_id:uid,recipient_name:'Nina',skill:'Press'}});assert.equal((await h.admin.POST(request({id,userId:uid,name:'Other',skill:'Press'}))).status,409);assert.equal(h.calls.length,0);});
test('duplicate skill constraint returns conflict and sends no email',async()=>{const h=harness({insertError:{code:'23505'}});assert.equal((await h.admin.POST(request({id,userId:uid,name:'Nina',skill:'Press'}))).status,409);assert.ok(!h.calls.some(c=>c.email));});
test('PDF validation failure prevents creating an award',async()=>{const h=harness({pdfError:'Please use Latin letters'});assert.equal((await h.admin.POST(request({id,userId:uid,name:'Nina',skill:'Press'}))).status,400);assert.equal(h.writes.length,0);});
test('seen acknowledgment is constrained to its owner and previously unseen awards',async()=>{const h=harness({user:{id:uid,isAdmin:false}});await h.member.PATCH(request({id}));assert.deepEqual(h.calls[0].filters,[['id',id],['user_id',uid],['seen_at',null]]);});
test('printable PDF preserves one landscape page and generates deterministic bytes',async()=>{
 const {createCertificatePdf}=load('lib/certificatePdf.ts');const {PDFDocument}=require('pdf-lib');
 const data={id,recipient_name:'Nina Grishchenko',skill:'Candle One-Arm Handstand',award_date:'2026-10-04',awarded_at:'2026-10-04T21:00:00Z'};
 const a=await createCertificatePdf(data),b=await createCertificatePdf(data);assert.deepEqual(a,b);
 const doc=await PDFDocument.load(a);assert.equal(doc.getPages().length,1);assert.deepEqual(doc.getPages()[0].getSize(),{width:792,height:612});
 const long=await createCertificatePdf({...data,recipient_name:'Alexandra María Elizabeth de la Cruz',skill:'Straddle One-Arm Handstand with Controlled Shape Transitions'});assert.ok(long.length>10000);
});
test('email escapes recipient content, attaches generated PDF, and uses a stable retry key',async()=>{
 const sent=[],updates=[];let claimed=true;
 const db={rpc:async()=>({data:claimed?[{id,recipient_name:'Nina <script>',skill:'Press & balance',award_date:'2026-10-04',awarded_at:'2026-10-04T21:00:00Z',recipient_email:'member@example.com'}]:[],error:null}),from:()=>({update:value=>{updates.push(value);const q={eq:()=>q,then:r=>Promise.resolve({error:null}).then(r)};return q;}})};
 const mod=load('lib/certificateEmail.ts',{'./supabase':{createAdminClient:()=>db},'./certificatePdf':{createCertificatePdf:async()=>Buffer.from('%PDF-fixture')},resend:{Resend:class{emails={send:async(...args)=>{sent.push(args);return {data:{id:'email-1'},error:null};}}}}});
 process.env.RESEND_API_KEY='test-fixture-only';await mod.sendCertificateEmail(id);delete process.env.RESEND_API_KEY;
 assert.equal(sent[0][0].to,'member@example.com');assert.ok(sent[0][0].html.includes('Nina &lt;script&gt;'));assert.equal(sent[0][0].attachments[0].content.toString(),'%PDF-fixture');assert.equal(sent[0][1].idempotencyKey,`certificate-${id}-v1`);assert.equal(updates[0].email_status,'sent');claimed=false;await mod.sendCertificateEmail(id);assert.equal(sent.length,1);
});
test('failed email keeps certificate and records retryable failure',async()=>{
 const updates=[];const db={rpc:async()=>({data:[{id}],error:null}),from:()=>({update:value=>{updates.push(value);const q={eq:()=>q,then:r=>Promise.resolve({error:null}).then(r)};return q;}})};
 const mod=load('lib/certificateEmail.ts',{'./supabase':{createAdminClient:()=>db}});delete process.env.RESEND_API_KEY;await mod.sendCertificateEmail(id);assert.equal(updates[0].email_status,'failed');
});
