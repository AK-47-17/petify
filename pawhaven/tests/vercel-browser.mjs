import {chromium} from '../outputs/qa/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3000';
const forged={'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'ayushsingh941526@gmail.com'};
const session=await fetch(base+'/api/session',{headers:forged});const data=await session.json();
assert.equal(data.user,null);assert.equal(data.chatGPTAuthEnabled,false);assert.ok(session.headers.get('cache-control').includes('no-store'));
for(const endpoint of ['records','admin/summary','admin/customers','admin/audit'])assert.equal((await fetch(base+'/api/'+endpoint,{headers:forged})).status,401);
assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({email:'a@example.test',password:'password'})})).status,403);
assert.equal((await fetch(base+'/api/catalog')).status,200);
const html=await fetch(base);const text=await html.text();assert.ok(html.headers.get('content-security-policy').includes("'strict-dynamic'"));assert.match(text,/nonce="[^"]+"/);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(base,{waitUntil:'networkidle'});await page.getByRole('heading',{name:/For the love/}).waitFor();
 await page.getByRole('button',{name:'Explore care',exact:true}).click();await page.getByRole('link',{name:/Sign in to continue/}).waitFor();await page.locator('.modal').getByRole('button',{name:/Close/}).click();
 await page.screenshot({path:'outputs/petify-vercel-desktop.png',fullPage:true,animations:'disabled'});
 for(const path of ['/services','/shop','/account','/admin','/login','/register']){await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(await page.getByRole('link',{name:'Continue with ChatGPT',exact:true}).count(),0);}
 await page.goto(base+'/login',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Welcome back, pet parent.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isDisabled(),true);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/petify-vercel-login-mobile.png',fullPage:true,animations:'disabled'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(base,{waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: native Next.js routes, public browsing, mobile layout, hydration, nonce CSP, CSRF rejection, forged-admin-header rejection and honest unconfigured-login state.');
}finally{await browser.close();}
