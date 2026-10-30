import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth, getIdentity, isAdmin } from '../lib/auth';
const req=new Request('https://petify.example/api/auth/login',{method:'POST'});
const confirmed={id:'customer-123',email:'parent@example.test',email_confirmed_at:'2026-10-31T00:00:00Z',user_metadata:{name:'Pet Parent',role:'admin'}};
test('email login creates a secure HttpOnly cookie and never exposes provider tokens to JavaScript',async()=>{
 globalThis.fetch=async()=>Response.json({user:confirmed,access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600});
 const response=await handleAuth(req,'login',{email:'parent@example.test',password:'a-long-test-password'});const cookie=response.headers.get('set-cookie')!;
 for(const part of ['__Host-petify-session=','HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age=3600'])assert.ok(cookie.includes(part));
 assert.deepEqual(await response.json(),{ok:true,recovery:false});
});
test('unconfirmed email cannot acquire a Petify session',async()=>{
 globalThis.fetch=async()=>Response.json({user:{...confirmed,email_confirmed_at:null},access_token:'unconfirmed-token'});
 await assert.rejects(()=>handleAuth(req,'login',{email:confirmed.email,password:'a-long-test-password'}),/Confirm your email/);
});
test('registration ignores autoissued tokens until email login and rejects injected roles',async()=>{
 globalThis.fetch=async()=>Response.json({user:confirmed,access_token:'ignored-token'});
 const r=await handleAuth(req,'register',{email:confirmed.email,password:'a-long-test-password',name:'Pet Parent'});assert.equal(r.headers.get('set-cookie'),null);
 await assert.rejects(()=>handleAuth(req,'register',{email:confirmed.email,password:'a-long-test-password',name:'Pet Parent',role:'admin'}));
});
test('cookie identity is validated with the provider; user metadata cannot grant admin access',async()=>{
 globalThis.fetch=async()=>Response.json(confirmed);
 const user=await getIdentity(new Request(req.url,{headers:{cookie:'__Host-petify-session=test-token'}}));assert.equal(user?.userId,'email:customer-123');assert.equal(isAdmin(user),false);
 assert.equal(isAdmin({...user!,email:'owner@example.test',verified:false}),false);assert.equal(isAdmin({...user!,email:'owner@example.test',verified:true}),true);
 globalThis.fetch=async()=>Response.json({error:'invalid'},{status:401});assert.equal(await getIdentity(new Request(req.url,{headers:{cookie:'__Host-petify-session=forged'}})),null);
});
test('signout expires the cookie and password recovery returns only a generic response',async()=>{
 globalThis.fetch=async()=>Response.json({});const logout=await handleAuth(req,'logout',{});assert.match(logout.headers.get('set-cookie')!,/Max-Age=0/);
 const known=await handleAuth(req,'recover',{email:confirmed.email});const unknown=await handleAuth(req,'recover',{email:'unknown@example.test'});assert.deepEqual(await known.json(),await unknown.json());
});
test('provider failure remains a safe error and cannot authenticate a visitor',async()=>{
 globalThis.fetch=async()=>{throw new Error('upstream secret detail')};await assert.rejects(()=>getIdentity(new Request(req.url,{headers:{cookie:'__Host-petify-session=test-token'}})),/sign-in service is unavailable/);
});
