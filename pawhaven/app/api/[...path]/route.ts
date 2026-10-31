import { env } from '@/lib/runtime';
import { chatGPTAuthEnabled } from '@/lib/platform';
import { z } from 'zod';
import { getIdentity, isAdmin, emailAuthReady, handleAuth, ApiError } from '../../../lib/auth';
import { adminRead, updateOperations, rememberCustomer } from '../../../lib/admin';
import { services, products } from '../../../lib/catalog';
import { petSchema, addressSchema, bookingSchema, checkoutSchema, requestSchema, checkoutTotal, canTransition } from '../../../lib/validation';

export const dynamic = 'force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
type Row={id:string;owner:string;kind:string;payload:string;status:string;amount:number;created_at:string;updated_at:string};
const clean=(row:Row)=>({id:row.id,kind:row.kind,data:JSON.parse(row.payload),status:row.status,amount:row.amount,createdAt:row.created_at,updatedAt:row.updated_at});
async function body(req:Request){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new ApiError(415,'JSON is required.');
 if(Number(req.headers.get('content-length')||0)>16384)throw new ApiError(413,'Request is too large.');
 const reader=req.body?.getReader(); if(!reader)throw new ApiError(400,'Missing request.');
 const chunks:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();throw new ApiError(413,'Request is too large.')}chunks.push(value)}
 const buffer=new Uint8Array(length);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder().decode(buffer))}catch{throw new ApiError(400,'Invalid JSON.')}
}
function guardOrigin(req:Request){
 const origin=req.headers.get('origin');
 if(!origin || origin!==new URL(req.url).origin || req.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'This request must come from Petify.');
}
async function handle(req:Request){
 try{
 const path=new URL(req.url).pathname.replace('/api/','').split('/');
 if(path[0]==='auth' && req.method==='POST'){guardOrigin(req);return await handleAuth(req,path[1],await body(req));}
 const user=await getIdentity(req);
 const admin=isAdmin(user);
 if(req.method==='GET' && path[0]==='session'){if(user&&env.DB)await rememberCustomer(env.DB,user);return json({user:user?{name:user.displayName,email:user.email,id:user.userId,admin,provider:user.provider}:null,emailAuthReady:emailAuthReady(),chatGPTAuthEnabled});}
 if(req.method==='GET' && path[0]==='catalog')return json({services,products});
 if(path[0]!=='adoptions'&&!user)throw new ApiError(401,'Sign in to continue.');
 const db=env.DB;if(!db)throw new ApiError(503,'The service is temporarily unavailable. Please try again shortly.');
 if(req.method==='GET' && path[0]==='adoptions'){
  const {results}=await db.prepare("SELECT * FROM records WHERE kind='rehome' AND status='published' ORDER BY created_at DESC LIMIT 100").all<Row>();
  return json({items:results.map(r=>{const p=JSON.parse(r.payload);return {id:r.id,name:p.subject,city:p.city,species:p.species||'Dog',age:p.age,breed:p.breed,gender:p.gender,description:p.notes}})});
 }
 if(!user)throw new ApiError(401,'Sign in to continue.');
 if(path[0]==='admin' && !admin)throw new ApiError(403,'Administrator access is required.');
 if(req.method==='GET' && path[0]==='records'){
  const {results}=await db.prepare('SELECT * FROM records WHERE owner=? ORDER BY created_at DESC LIMIT 200').bind(user.userId).all<Row>();return json({items:results.map(clean)});
 }
 if(req.method==='GET' && path[0]==='admin'){
  return json(await adminRead(db,new URL(req.url)));
 }
 if(!['POST','PATCH','DELETE'].includes(req.method))throw new ApiError(404,'Not found.');
 guardOrigin(req);
 const now=Date.now(),rateKey=user.userId+':write';
 const limit=await db.prepare('INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires<? THEN 1 ELSE rate_limits.count+1 END,expires=CASE WHEN rate_limits.expires<? THEN ? ELSE rate_limits.expires END RETURNING count').bind(rateKey,now+60000,now,now,now+60000).first<{count:number}>();
 if((limit?.count||0)>20)throw new ApiError(429,'Too many requests. Please wait a minute.');
 await rememberCustomer(db,user);
 if(path[0]==='admin' && path[1] && path[2]==='operations' && req.method==='PATCH')return json(await updateOperations(db,path[1],await body(req),user));
 if(req.method==='POST' && path[0]==='records'){
  const key=req.headers.get('idempotency-key');if(!key || !/^[a-zA-Z0-9-]{16,80}$/.test(key))throw new ApiError(400,'Missing request identifier. Please try again.');
  const old=await db.prepare('SELECT * FROM records WHERE owner=? AND request_key=?').bind(user.userId,key).first<Row>();if(old)return json({item:clean(old)});
  const input=z.object({kind:z.enum(['pet','address','booking','order','request']),data:z.unknown()}).strict().parse(await body(req));
  let data:unknown,amount=0,kind:string=input.kind,status='pending';
  if(kind==='pet'){data=petSchema.parse(input.data);status='active'}
  else if(kind==='address'){data=addressSchema.parse(input.data);status='active'}
  else if(kind==='booking'){const b=bookingSchema.parse(input.data);data=b;amount=services.find(s=>s.id===b.service)!.packages[b.package].price;}
  else if(kind==='order'){const order=checkoutSchema.parse(input.data);try{amount=checkoutTotal(order.items)}catch{throw new ApiError(400,'The cart contains an unavailable item.')}data=order;}
  else {const request=requestSchema.parse(input.data);data=request;kind=request.type;
   if(kind==='rehome' && (!request.species || !request.breed || request.age===undefined || !request.gender))throw new ApiError(400,'Complete all pet details.');
   if(kind==='adoption' && request.petId){const pet=await db.prepare("SELECT id FROM records WHERE id=? AND kind='rehome' AND status='published'").bind(request.petId).first();if(!pet)throw new ApiError(409,'This pet is no longer available.');}
  }
  const id=crypto.randomUUID(),date=new Date().toISOString();
  await db.prepare('INSERT INTO records (id,owner,kind,payload,status,amount,request_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,request_key) DO NOTHING').bind(id,user.userId,kind,JSON.stringify(data),status,amount,key,date,date).run();
  const saved=await db.prepare('SELECT * FROM records WHERE owner=? AND request_key=?').bind(user.userId,key).first<Row>();return json({item:clean(saved!)},201);
 }
 if(path[0]==='records' && path[1] && ['PATCH','DELETE'].includes(req.method)){
  const row=await db.prepare('SELECT * FROM records WHERE id=? AND owner=?').bind(path[1],user.userId).first<Row>();if(!row)throw new ApiError(404,'Record not found.');
  if(req.method==='DELETE'){
   if(!['pet','address'].includes(row.kind))throw new ApiError(403,'This record cannot be deleted.');
   await db.batch([db.prepare('DELETE FROM record_operations WHERE record_id=? AND EXISTS (SELECT 1 FROM records WHERE id=? AND owner=?)').bind(row.id,row.id,user.userId),db.prepare('DELETE FROM records WHERE id=? AND owner=?').bind(row.id,user.userId)]);return json({ok:true});
  }
  const change=z.object({status:z.literal('cancelled')}).strict().parse(await body(req));
  if(row.status!=='pending')throw new ApiError(409,'Only pending requests can be cancelled here. Contact support for confirmed bookings.');
  await db.prepare("UPDATE records SET status=?,updated_at=? WHERE id=? AND owner=? AND status='pending'").bind(change.status,new Date().toISOString(),row.id,user.userId).run();return json({ok:true});
 }
 if(path[0]==='admin' && path[1] && req.method==='PATCH'){
  const change=z.object({status:z.enum(['confirmed','cancelled','declined','completed','published','archived']),expectedStatus:z.string().max(20)}).strict().parse(await body(req));
  const row=await db.prepare('SELECT * FROM records WHERE id=?').bind(path[1]).first<Row>();if(!row)throw new ApiError(404,'Record not found.');
  if(row.status!==change.expectedStatus || !canTransition(row.kind,row.status,change.status))throw new ApiError(409,'The record changed or this transition is unavailable. Refresh and try again.');
  const date=new Date().toISOString();
  const result=await db.batch([
   db.prepare('UPDATE records SET status=?,updated_at=? WHERE id=? AND status=?').bind(change.status,date,row.id,row.status),
   db.prepare('INSERT INTO audit_log (id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),user.userId,change.status,row.id,date),
  ]);
  if(!result[0].meta.changes)throw new ApiError(409,'The record changed. Refresh and try again.');return json({ok:true});
 }
 throw new ApiError(404,'Not found.');
 }catch(error){
  if(error instanceof z.ZodError)return json({error:error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join('; ')},400);
  if(error instanceof ApiError)return json({error:error.message},error.status);
  console.error('Petify API failure',{name:error instanceof Error?error.name:'Unknown'});
  return json({error:'We could not complete that request. Please try again shortly.'},500);
 }
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;
