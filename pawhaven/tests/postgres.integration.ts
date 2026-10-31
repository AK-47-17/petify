import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {engine,database} from './postgres-runtime';
import {postgresQuery} from '../lib/database';
import {GET,POST,PATCH,DELETE} from '../app/api/[...path]/route';
import {adminRead} from '../lib/admin';

before(async()=>{
 await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 const migration=readFileSync('supabase/migrations/202610310001_petify.sql','utf8');await engine.exec(migration);await engine.exec(migration);
 globalThis.fetch=async(_url,options)=>{const token=new Headers(options?.headers).get('authorization')?.replace('Bearer ','');if(!token)return Response.json({error:'Invalid token'},{status:401});return Response.json({id:token,email:token==='admin'?'owner@example.test':token+'@example.test',email_confirmed_at:'2026-10-31T00:00:00Z',user_metadata:{name:token,role:'admin'}});};
});
after(()=>engine.close());
const call=async(path:string,method='GET',body?:unknown,user='alice',extra:Record<string,string>={})=>{
 const request=new Request('https://petify.example/api/'+path,{method,headers:{...(user?{cookie:'__Host-petify-session='+user}:{}),...(method!=='GET'?{'Content-Type':'application/json',Origin:'https://petify.example','Idempotency-Key':crypto.randomUUID()}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
 const handler={GET,POST,PATCH,DELETE}[method as 'GET'];const response=await handler(request);return {status:response.status,body:await response.json() as any};
};
const order={kind:'order',data:{name:'Test Parent',phone:'9876543210',city:'Bengaluru',address:'10 Test Road Sample Area',pincode:'560001',consent:true,items:[{id:'toy',quantity:2}]}};
test('PostgreSQL placeholders preserve literals and keep customer input out of SQL',()=>{
 const result=postgresQuery("SELECT '?' AS literal FROM records WHERE owner=? AND kind='order'",["x'; DELETE FROM records;--"]);assert.equal(result.text,"SELECT '?' AS literal FROM petify.records WHERE owner=$1 AND kind='order'");assert.equal(result.parameters[0],"x'; DELETE FROM records;--");assert.throws(()=>postgresQuery('SELECT ?',[undefined]));
});
test('Supabase schema blocks public and authenticated Data API roles',async()=>{
 const r=await engine.query<{allowed:boolean}>("SELECT has_schema_privilege('anon','petify','USAGE') OR has_schema_privilege('authenticated','petify','USAGE') AS allowed");assert.equal(r.rows[0].allowed,false);
 const tables=await engine.query<{relrowsecurity:boolean}>("SELECT relrowsecurity FROM pg_class WHERE relnamespace='petify'::regnamespace AND relkind='r'");assert.equal(tables.rows.length,5);assert.ok(tables.rows.every(t=>t.relrowsecurity));
});
test('real PostgreSQL API: sessions, idempotency, ownership, status, notes, payments, search and summaries',async()=>{
 const session=await call('session');assert.equal(session.body.chatGPTAuthEnabled,false);assert.equal(session.body.user.admin,false);
 assert.equal((await call('admin/summary')).status,403);
 assert.equal((await call('records','GET',undefined,'',{'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'owner@example.test'})).status,401);
 const key=crypto.randomUUID();const created=await call('records','POST',order,'alice',{'Idempotency-Key':key});assert.equal(created.status,201,JSON.stringify(created));const id=created.body.item.id;assert.equal(created.body.item.amount,698);
 assert.equal((await call('records','POST',order,'alice',{'Idempotency-Key':key})).body.item.id,id);
 assert.equal((await call('records','GET',undefined,'bob')).body.items.length,0);
 assert.equal((await call('records/'+id,'PATCH',{status:'cancelled'},'bob')).status,404);
 assert.equal((await call('admin/'+id,'PATCH',{status:'confirmed',expectedStatus:'pending'},'admin')).status,200);
 assert.equal((await call('admin/'+id,'PATCH',{status:'confirmed',expectedStatus:'pending'},'admin')).status,409);
 const operations={notes:'Private coordinator notes',assignedTo:'QA team',paymentStatus:'paid',paidAmount:698,version:0};
 assert.equal((await call('admin/'+id+'/operations','PATCH',operations,'admin')).status,200);
 assert.equal((await call('admin/'+id+'/operations','PATCH',operations,'admin')).status,409);
 assert.equal((await call('admin/'+id+'/operations','PATCH',{...operations,version:1},'admin')).status,200);
 assert.ok(!JSON.stringify((await call('records')).body).includes('Private coordinator notes'));
 const summary=await adminRead(database,new URL('https://petify.example/api/admin/summary'));assert.equal(summary.totals?.orders,1);assert.equal(summary.payments?.collected,698);
 const customers=await call('admin/customers?q=alice','GET',undefined,'admin');assert.equal(customers.body.total,1);assert.equal(customers.body.items[0].requests,1);
 assert.equal((await call('admin?owner=email:alice&status=confirmed','GET',undefined,'admin')).body.total,1);
 assert.equal((await call('admin/audit','GET',undefined,'admin')).body.items.length,3);
});
test('PostgreSQL batch rolls back earlier writes when a later statement fails',async()=>{
 await assert.rejects(()=>database.batch([database.prepare("INSERT INTO rate_limits(key,count,expires) VALUES ('rollback-probe',1,1000)"),database.prepare('SELECT * FROM table_that_does_not_exist')]));
 assert.equal(await database.prepare("SELECT * FROM rate_limits WHERE key='rollback-probe'").first(),null);
});
test('saved pet deletion removes private operations and adoption publishing remains sanitized',async()=>{
 const pet=await call('records','POST',{kind:'pet',data:{name:'Milo',species:'Dog',breed:'Indie',age:2,gender:'Male',weight:10,notes:''}});assert.equal(pet.status,201);
 assert.equal((await call('admin/'+pet.body.item.id+'/operations','PATCH',{notes:'Staff only',assignedTo:'',paymentStatus:'unpaid',paidAmount:0,version:0},'admin')).status,200);
 assert.equal((await call('records/'+pet.body.item.id,'DELETE',{})).status,200);
 const rehome=await call('records','POST',{kind:'request',data:{type:'rehome',name:'Test Parent',phone:'9876543210',city:'Bengaluru',subject:'Milo',notes:'Friendly dog',species:'Dog',breed:'Indie',age:2,gender:'Male',consent:true}});assert.equal(rehome.status,201);
 assert.equal((await call('admin/'+rehome.body.item.id,'PATCH',{status:'published',expectedStatus:'pending'},'admin')).status,200);
 const feed=(await call('adoptions','GET',undefined,'')).body.items;assert.equal(feed.length,1);assert.equal(feed[0].phone,undefined);assert.equal(feed[0].owner,undefined);
});
test('PostgreSQL enforces atomic rate limits and request origin protection',async()=>{
 assert.equal((await call('records','POST',order,'rate',{Origin:'https://evil.example'})).status,403);
 let limited=false;for(let i=0;i<22;i++){const r=await call('records','POST',order,'rate',{'Idempotency-Key':'rate-limit-test-key-12345678'});if(r.status===429){limited=true;break;}assert.ok([200,201].includes(r.status),JSON.stringify(r));}assert.ok(limited);
});
