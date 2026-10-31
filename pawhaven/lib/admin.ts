import type { Database } from './database';
import { z } from 'zod';
import { ApiError, type Identity } from './auth';

export async function rememberCustomer(db:Database,user:Identity) {
 const now=new Date().toISOString();
 await db.prepare('INSERT INTO customers (id,email,name,provider,created_at,last_seen) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,last_seen=excluded.last_seen').bind(user.userId,user.email,user.displayName,user.provider,now,now).run();
}
const mapped=(r:Record<string,unknown>)=>({id:r.id,owner:r.owner,kind:r.kind,data:JSON.parse(r.payload as string),status:r.status,amount:r.amount,createdAt:r.created_at,updatedAt:r.updated_at,customer:{name:r.customer_name||'',email:r.email||''},operations:{notes:r.notes||'',assignedTo:r.assigned_to||'',paymentStatus:r.payment_status||'unpaid',paidAmount:r.paid_amount||0,version:r.version||0}});
const joined='FROM records r LEFT JOIN customers c ON c.id=r.owner LEFT JOIN record_operations o ON o.record_id=r.id';
export async function adminRead(db:Database,url:URL) {
 const section=url.pathname.split('/')[3];
 const page=Math.max(1,Math.min(100000,Math.trunc(Number(url.searchParams.get('page'))||1))),limit=25,offset=(page-1)*limit;
 if(section==='summary') {
  const [totals,groups,daily,payments]=await Promise.all([
   db.prepare("SELECT COUNT(*) AS requests, SUM(CASE WHEN kind='booking' THEN 1 ELSE 0 END) AS bookings, SUM(CASE WHEN kind='order' THEN 1 ELSE 0 END) AS orders, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending, COUNT(DISTINCT owner) AS customers, COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN amount ELSE 0 END),0) AS confirmedValue FROM records WHERE kind NOT IN ('pet','address')").first(),
   db.prepare("SELECT kind,status,COUNT(*) AS count FROM records WHERE kind NOT IN ('pet','address') GROUP BY kind,status").all(),
   db.prepare("SELECT substr(created_at,1,10) AS date,COUNT(*) AS count FROM records WHERE kind IN ('booking','order') AND created_at>=? GROUP BY substr(created_at,1,10) ORDER BY date").bind(new Date(Date.now()-13*86400000).toISOString().slice(0,10)).all(),
   db.prepare("SELECT COALESCE(SUM(CASE WHEN payment_status='paid' THEN paid_amount ELSE 0 END),0) AS collected,COALESCE(SUM(CASE WHEN payment_status='refunded' THEN paid_amount ELSE 0 END),0) AS refunded FROM record_operations").first()
  ]);return {totals,payments,groups:groups.results,daily:daily.results};
 }
 if(section==='customers') {
  const query=(url.searchParams.get('q')||'').slice(0,150);const where='WHERE (c.name LIKE ? OR c.email LIKE ? OR c.id LIKE ?)';const args=Array(3).fill('%'+query+'%');
  const count=await db.prepare('SELECT COUNT(*) AS count FROM customers c '+where).bind(...args).first<{count:number}>();
  const {results}=await db.prepare("SELECT c.*, COUNT(CASE WHEN r.kind NOT IN ('pet','address') THEN 1 END) AS requests, COALESCE(SUM(CASE WHEN r.status IN ('confirmed','completed') THEN r.amount ELSE 0 END),0) AS value FROM customers c LEFT JOIN records r ON r.owner=c.id "+where+' GROUP BY c.id ORDER BY c.last_seen DESC LIMIT ? OFFSET ?').bind(...args,limit,offset).all();return {items:results,total:count?.count||0,page,limit};
 }
 if(section==='audit') {
  const count=await db.prepare('SELECT COUNT(*) AS count FROM audit_log').first<{count:number}>();
  const {results}=await db.prepare('SELECT a.*,c.email,c.name FROM audit_log a LEFT JOIN customers c ON c.id=a.actor ORDER BY a.created_at DESC LIMIT ? OFFSET ?').bind(limit,offset).all();return {items:results,total:count?.count||0,page,limit};
 }
 const conditions:string[]=[],args:(string|number)[]=[];
 for(const [parameter,column] of [['kind','r.kind'],['status','r.status'],['owner','r.owner']] as const){const v=url.searchParams.get(parameter);if(v){if(parameter==='kind'&&v==='enquiries')conditions.push("r.kind NOT IN ('booking','order','pet','address')");else{conditions.push(column+'=?');args.push(v.slice(0,150));}}}
 const q=url.searchParams.get('q');if(q){conditions.push('(r.id LIKE ? OR r.payload LIKE ? OR c.email LIKE ? OR c.name LIKE ?)');args.push(...Array(4).fill('%'+q.slice(0,150)+'%'));}
 if(section){conditions.push('r.id=?');args.push(section);}
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const count=await db.prepare('SELECT COUNT(*) AS count '+joined+where).bind(...args).first<{count:number}>();
 const {results}=await db.prepare('SELECT r.*,c.name AS customer_name,c.email,o.notes,o.assigned_to,o.payment_status,o.paid_amount,o.version '+joined+where+' ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?').bind(...args,limit,offset).all<Record<string,unknown>>();
 return {items:results.map(mapped),total:count?.count||0,page,limit};
}
export async function updateOperations(db:Database,id:string,input:unknown,user:Identity) {
 const data=z.object({notes:z.string().max(4000),assignedTo:z.string().trim().max(120),paymentStatus:z.enum(['unpaid','paid','refunded']),paidAmount:z.number().int().min(0).max(10000000),version:z.number().int().min(0)}).strict().parse(input);
 const record=await db.prepare('SELECT kind,status FROM records WHERE id=?').bind(id).first<{kind:string;status:string}>();if(!record)throw new ApiError(404,'Record not found.');
 if(data.paymentStatus==='unpaid'&&data.paidAmount!==0 || data.paymentStatus!=='unpaid'&&data.paidAmount<=0)throw new ApiError(400,'Enter the amount received or refunded. Unpaid records must have a zero amount.');
 if(data.paymentStatus!=='unpaid'&&(!['booking','order'].includes(record.kind)||['pending','declined'].includes(record.status)))throw new ApiError(400,'Confirm this booking or order before recording payment.');
 const now=new Date().toISOString();
 const result=await db.batch([
 db.prepare('INSERT INTO record_operations (record_id,notes,assigned_to,payment_status,paid_amount,version,updated_at) SELECT ?,?,?,?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM record_operations WHERE record_id=? AND version=?) ON CONFLICT(record_id) DO UPDATE SET notes=?,assigned_to=?,payment_status=?,paid_amount=?,version=record_operations.version+1,updated_at=? WHERE record_operations.version=?').bind(id,data.notes,data.assignedTo,data.paymentStatus,data.paidAmount,now,data.version,id,data.version,data.notes,data.assignedTo,data.paymentStatus,data.paidAmount,now,data.version),
 db.prepare('INSERT INTO audit_log (id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),user.userId,`Operations saved; payment ${data.paymentStatus}; amount INR ${data.paidAmount}; assignee ${data.assignedTo||'unassigned'}`,id,now)
 ]);if(!result[0].meta.changes)throw new ApiError(409,'Someone updated this record. Refresh before saving again.');
 return {ok:true};
}
