import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getChatGPTUser } from '../app/chatgpt-auth';

type AuthEnvironment = { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string; ADMIN_USER_IDS?: string; ADMIN_EMAILS?: string };
export type Identity = { userId: string; email: string; displayName: string; provider: 'email' | 'chatgpt'; verified: boolean };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const settings = () => env as unknown as AuthEnvironment;
export function emailAuthReady() { const s=settings(); return !!(s.SUPABASE_URL && s.SUPABASE_PUBLISHABLE_KEY); }
const cookieName = (req: Request) => new URL(req.url).protocol === 'https:' ? '__Host-petify-session' : 'petify-local-session';
function tokenFrom(req: Request) { return req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(req)+'='))?.slice(cookieName(req).length+1); }
function sessionCookie(req: Request, token: string, seconds: number) { return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`; }
export async function providerFetch(path: string, method='GET', data?: unknown, token?: string) {
 const s=settings(); if(!emailAuthReady()) throw new ApiError(503,'Email sign-in is being connected. You can still browse Petify or use the available sign-in option.');
 const url=new URL(s.SUPABASE_URL!); if(url.protocol!=='https:' || !url.hostname.endsWith('.supabase.co')) throw new ApiError(503,'Email sign-in configuration needs attention.');
 try { return await fetch(url.origin+'/auth/v1/'+path,{method,headers:{apikey:s.SUPABASE_PUBLISHABLE_KEY!,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(12000)}); }
 catch { throw new ApiError(503,'The sign-in service is unavailable. Please try again shortly.'); }
}
function identity(u: { id: string; email?: string; email_confirmed_at?: string; user_metadata?: { name?: string } }): Identity {
 return {userId:'email:'+u.id,email:u.email||'',displayName:typeof u.user_metadata?.name==='string'?u.user_metadata.name.slice(0,100):u.email||'Pet parent',verified:!!u.email_confirmed_at,provider:'email'};
}
export async function getIdentity(req: Request): Promise<Identity|null> {
 const token=tokenFrom(req);
 if(token && emailAuthReady()) { const response=await providerFetch('user','GET',undefined,token); if(response.ok){const u=identity(await response.json()); if(u.verified)return u;} else if(response.status>=500)throw new ApiError(503,'The sign-in service is unavailable. Please try again shortly.'); }
 const u=await getChatGPTUser(); return u?{...u,provider:'chatgpt',verified:true}:null;
}
export function isAdmin(user: Identity|null) { const s=settings(); return !!user && ((s.ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).includes(user.userId) || (user.verified && (s.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase()))); }
export async function authLimit(req: Request, email: string) {
 if(!env.DB)throw new ApiError(503,'Sign-in is temporarily unavailable.');
 const now=Date.now(); const ip=req.headers.get('cf-connecting-ip')||'local';
 for(const [value,max] of [[ip,40],[email.toLowerCase(),8]] as const) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  const key='auth:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const r=await env.DB.prepare('INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING count').bind(key,now+900000,now,now,now+900000).first<{count:number}>();
  if((r?.count||0)>max)throw new ApiError(429,'Too many sign-in attempts. Please try again in 15 minutes.');
 }
}
const email=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const password=z.string().min(12,'Use at least 12 characters.').max(128);
export async function handleAuth(req: Request, action: string, input: unknown): Promise<Response> {
 const result=(value:unknown,cookie?:string)=>Response.json(value,{headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
 if(action==='logout') { const token=tokenFrom(req); if(token&&emailAuthReady()) await providerFetch('logout','POST',undefined,token).catch(()=>{}); return result({ok:true},sessionCookie(req,'',0)); }
 if(action==='password') {
  const data=z.object({password}).strict().parse(input),token=tokenFrom(req); if(!token)throw new ApiError(401,'Verify your recovery code first.');
  const r=await providerFetch('user','PUT',data,token); if(!r.ok)throw new ApiError(400,'Password could not be changed. Use a new password and try again.');
  await providerFetch('logout','POST',undefined,token); return result({ok:true,message:'Password updated. Please sign in again.'},sessionCookie(req,'',0));
 }
 if(!['login','register','recover','verify','resend'].includes(action))throw new ApiError(404,'Not found.');
 const schema=action==='login'?z.object({email,password:z.string().min(1).max(128)}).strict():action==='register'?z.object({email,password,name:z.string().trim().min(2).max(100)}).strict():action==='verify'?z.object({email,token:z.string().regex(/^\d{6,10}$/),type:z.enum(['signup','recovery'])}).strict():z.object({email}).strict();
 const data=schema.parse(input) as Record<string,string>; await authLimit(req,data.email);
 if(action==='recover'||action==='resend') { const r=await providerFetch(action==='recover'?'recover':'resend','POST',{...data,...(action==='resend'?{type:'signup'}:{})}); if(r.status===429)throw new ApiError(429,'Please wait before requesting another email.'); if(r.status>=500)throw new ApiError(503,'Email delivery is unavailable. Please try again later.');return result({message:'If this address is eligible, an email will arrive shortly. Check your inbox and spam folder.'}); }
 const route=action==='login'?'token?grant_type=password':action==='register'?'signup':'verify';
 const payload=action==='register'?{email:data.email,password:data.password,data:{name:data.name}}:data;
 const response=await providerFetch(route,'POST',payload); const value=await response.json() as {access_token?:string;expires_in?:number;user?:Parameters<typeof identity>[0]};
 if(!response.ok)throw new ApiError(response.status===429?429:400,action==='login'?'Unable to sign in. Check your email and password, and confirm your email first.':action==='verify'?'This code is invalid or expired. Request a new email and try again.':'Unable to register. Try signing in, or use another password.');
 if(action==='register')return result({message:'Check your inbox to confirm your email. You can then sign in to Petify.'});
 if(!value.access_token||!value.user?.email_confirmed_at)throw new ApiError(401,'Confirm your email before signing in.');
 return result({ok:true,recovery:action==='verify'&&data.type==='recovery'},sessionCookie(req,value.access_token,Math.min(value.expires_in||3600,3600)));
}
