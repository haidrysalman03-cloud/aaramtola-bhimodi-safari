import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createAuthFlow } from '../auth-flow.js';
import { requireAdmin } from '../netlify/server/auth.mjs';

test('invite acceptance creates a cookie-backed login before accessing the editor',async()=>{
  const calls=[];
  const flow=createAuthFlow({handleAuthCallback:async()=>({type:'invite',token:'test-only'}),acceptInvite:async(token,password)=>{calls.push(['accept',token,password]);return {email:'admin@example.test'};},login:async(email,password)=>calls.push(['login',email,password])});
  assert.equal(await flow.initialize(),'invite');
  await assert.rejects(flow.submit('', 'long-test-password','mismatch'));
  assert.equal(calls.length,0);
  await flow.submit('', 'long-test-password','long-test-password');
  assert.deepEqual(calls,[['accept','test-only','long-test-password'],['login','admin@example.test','long-test-password']]);
  assert.equal(flow.mode,'login');
});
test('recovery verifies once and allows password update retry without reusing token',async()=>{
  let callbacks=0,updates=0,logins=0;
  const flow=createAuthFlow({handleAuthCallback:async()=>{callbacks++;return {type:'recovery'};},updateUser:async()=>{if(++updates===1)throw Error('offline');return {email:'admin@example.test'};},login:async()=>{logins++;}});
  assert.equal(await flow.initialize(),'recovery');
  await assert.rejects(flow.submit('', 'long-test-password','long-test-password'));
  await flow.submit('', 'long-test-password','long-test-password');
  assert.equal(callbacks,1);assert.equal(updates,2);assert.equal(logins,1);
});
test('invalid callbacks cannot become password login silently',async()=>{
  let logins=0;
  const flow=createAuthFlow({handleAuthCallback:async()=>{throw Error('expired');},login:async()=>logins++});
  await assert.rejects(flow.initialize());assert.equal(logins,0);
});
test('ordinary login trims email and accepts existing shorter passwords',async()=>{
  const flow=createAuthFlow({handleAuthCallback:async()=>null,login:async(email,password)=>({email,password})});
  await flow.initialize();assert.deepEqual(await flow.submit(' a@example.test ','short'),{email:'a@example.test',password:'short'});
});
test('all admin routes reject forged, expired, non-admin, and malformed sessions',async t=>{
  const app=new Hono();app.use('/api/admin/*',requireAdmin);app.all('/api/admin/*',c=>c.json({id:c.get('user').id}));
  for(const [record,expected] of [[null,401],[{id:'member',user_metadata:{roles:['admin']}},403],[{id:'member',app_metadata:{roles:'admin'}},403],[{id:'admin',app_metadata:{roles:['admin']}},200]]){
    t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(new URL(url).hostname,'aaramtola-bhimodi-safari.netlify.app');assert.equal(options.headers.Authorization,'Bearer test-only');return Response.json(record,{status:record?200:401});});
    for(const [path,method] of [['content','GET'],['save','POST'],['publish','POST'],['media/upload','POST']]){
      const result=await app.request('https://preview.test/api/admin/'+path,{method,headers:{Origin:'https://preview.test',Cookie:'nf_jwt=test-only'}});assert.equal(result.status,expected);
    }
    t.mock.restoreAll();
  }
  const result=await app.request('https://preview.test/api/admin/content',{headers:{Cookie:'nf_jwt=%ZZ'}});assert.equal(result.status,401);
  t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});
  assert.equal((await app.request('https://preview.test/api/admin/content',{headers:{Cookie:'nf_jwt=test-only'}})).status,503);
});
