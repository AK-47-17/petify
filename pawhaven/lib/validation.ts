import { z } from 'zod';
import { cities, products, services } from './catalog';
const name = z.string().trim().min(2).max(100);
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const notes = z.string().trim().max(2000).default('');
const city = z.enum(cities);
const consent = z.literal(true, {error:'Please agree before continuing'});
export const petSchema = z.object({name,species:z.enum(['Dog','Cat']),breed:z.string().trim().max(80),age:z.coerce.number().min(0).max(40),gender:z.enum(['Male','Female']),weight:z.coerce.number().min(0.1).max(150),notes}).strict();
export const addressSchema = z.object({name,phone,city,address:z.string().trim().min(10).max(500),pincode:z.string().regex(/^[1-9]\d{5}$/)}).strict();
export const bookingSchema = z.object({service:z.string(),package:z.coerce.number().int().min(0).max(3),species:z.enum(['Dog','Cat']),petName:name,breed:z.string().trim().max(80),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.enum(['09:00–12:00','12:00–15:00','15:00–18:00','18:00–20:00']),city,name,phone,address:z.string().trim().min(10).max(500),pincode:z.string().regex(/^[1-9]\d{5}$/),notes,consent}).strict().superRefine((v,ctx)=>{
 const service=services.find(s=>s.id===v.service);
 if(!service || !service.packages[v.package]) ctx.addIssue({code:'custom',message:'Choose a valid service and package',path:['service']});
 if(service && !(service.species as readonly string[]).includes(v.species))ctx.addIssue({code:'custom',message:'This service is available for dogs only',path:['species']});
 const date=new Date(v.date+'T23:59:59+05:30');
 if(Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==v.date || date.getTime()<Date.now() || date.getTime()>Date.now()+180*86400000)ctx.addIssue({code:'custom',message:'Choose a real date within the next 180 days',path:['date']});
});
export const requestSchema=z.object({type:z.enum(['support','partner','membership','adoption','rehome','insurance','franchise','course','abuse','mating','referral']),name,phone,city,subject:z.string().trim().min(2).max(160),notes,consent,petId:z.string().max(80).optional(),species:z.enum(['Dog','Cat']).optional(),age:z.coerce.number().min(0).max(40).optional(),breed:z.string().trim().max(80).optional(),gender:z.enum(['Male','Female']).optional()}).strict();
export const checkoutSchema=z.object({name,phone,city,address:z.string().trim().min(10).max(500),pincode:z.string().regex(/^[1-9]\d{5}$/),items:z.array(z.object({id:z.string(),quantity:z.number().int().min(1).max(10)}).strict()).min(1).max(20),consent}).strict();
export function checkoutTotal(items:{id:string;quantity:number}[]){
 const ids=new Set<string>(); let total=0;
 for(const item of items){const product=products.find(p=>p.id===item.id);if(!product || ids.has(item.id) || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>10)throw new Error('Invalid cart'); ids.add(item.id);total+=product.price*item.quantity;}
 return total;
}
export function canTransition(kind:string,from:string,to:string){
 const transitions:Record<string,string[]>={pending:['confirmed','cancelled','declined'],confirmed:['completed','cancelled'],active:['archived']};
 if(kind==='rehome' && from==='pending' && to==='published') return true;
 if(kind==='rehome' && from==='published' && to==='archived') return true;
 return (transitions[from]||[]).includes(to);
}
