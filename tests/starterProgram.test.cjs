const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function harness({user={id:'authenticated-member'},authError=null,result='assigned',dbError=null}={}) {
  const calls=[];
  const filename=path.join(__dirname,'../app/api/dashboard/starter-program/route.ts');
  const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const deps={
    'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},
    '@supabase/supabase-js':{createClient:()=>({auth:{getUser:async()=>({data:{user},error:authError})}})},
    '@/lib/supabase':{createAdminClient:()=>({rpc:async(...args)=>{calls.push(args);return {data:result,error:dbError};}})},
  };
  const mod={exports:{}};
  new Function('require','module','exports',output)(name=>deps[name],mod,mod.exports);
  return {post:mod.exports.POST,calls};
}
const req=(body={level:'beginner'},token='Bearer valid')=>({headers:{get:()=>token},json:async()=>body});

test('missing, invalid or expired auth cannot reach assignment',async()=>{
  for(const opts of [{},{user:null},{authError:{message:'expired'}}]){
    const h=harness(opts);
    assert.equal((await h.post(req(undefined,Object.keys(opts).length?'Bearer bad':null))).status,401);
    assert.equal(h.calls.length,0);
  }
});
test('invalid levels and malformed requests do not reach the database',async()=>{
  for(const body of [null,{}, {level:'admin'}, {level:[]}, {level:{}}]){
    const h=harness();assert.equal((await h.post(req(body))).status,400);assert.equal(h.calls.length,0);
  }
  const h=harness();const request=req();request.json=async()=>{throw new Error('bad JSON');};
  assert.equal((await h.post(request)).status,400);assert.equal(h.calls.length,0);
});
test('each level uses only the verified member and server-owned template',async()=>{
  for(const level of ['beginner','intermediate','advanced']){
    const h=harness();const response=await h.post(req({level,userId:'another-member',steps:[{title:'injected'}]}));
    assert.equal(response.status,200);
    assert.deepEqual(h.calls,[['assign_starter_program',{p_user_id:'authenticated-member',p_level:level}]]);
    assert.equal(response.headers['Cache-Control'],'private, no-store');
  }
});
test('existing plans and repeat submissions return a conflict, not another write',async()=>{
  const h=harness({result:'existing_program'});const res=await h.post(req());
  assert.equal(res.status,409);assert.equal(res.body.code,'existing_program');assert.equal(h.calls.length,1);
});
test('inactive memberships and unavailable templates get actionable failures',async()=>{
  for(const [result,status] of [['subscription_required',403],['template_unavailable',503],['invalid_level',400]]){
    assert.equal((await harness({result}).post(req())).status,status);
  }
});
test('database errors never report successful assignment or expose details',async()=>{
  const res=await harness({dbError:{code:'test',message:'private details'}}).post(req());
  assert.equal(res.status,500);assert.equal(JSON.stringify(res).includes('private details'),false);
});
