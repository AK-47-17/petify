import {chromium} from '../outputs/qa/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try{
 const admin=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'oai-authenticated-user-id':'qa_admin','oai-authenticated-user-email':'qa_admin@example.test'}});
 const page=await admin.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8787/admin',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'A little care. A clear overview.'}).waitFor();await page.screenshot({path:'outputs/petify-admin-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Orders',exact:true}).click();await page.getByRole('button',{name:'Manage',exact:true}).first().waitFor();await page.getByRole('button',{name:'Manage',exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.locator('[name="notes"]').fill('Saved from browser QA');await page.getByRole('button',{name:'Save operations'}).click();await page.getByText('Private operations details saved.',{exact:true}).waitFor();await page.getByRole('button',{name:'Close request'}).click();
 await page.getByRole('button',{name:'Customers',exact:true}).click();await page.locator('.admin-table tbody tr').first().waitFor();await page.getByRole('button',{name:'View activity'}).first().click();await page.getByRole('heading',{name:'Requests from this customer'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/Overview/}).click();await page.screenshot({path:'outputs/petify-admin-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile admin must not overflow');
 const guest=await browser.newContext({viewport:{width:390,height:844}});const p=await guest.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});await p.getByRole('heading',{name:'Welcome back, pet parent.'}).waitFor();await p.screenshot({path:'outputs/petify-login-mobile.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.getByRole('link',{name:'Create an account',exact:true}).click();await p.getByRole('heading',{name:'A little more happy starts here.'}).waitFor();
 await p.goto('http://127.0.0.1:8787/admin',{waitUntil:'networkidle'});await p.getByRole('link',{name:/Administrator sign in/}).waitFor();assert.equal(await p.locator('.admin-table').count(),0);
 await p.goto('http://127.0.0.1:8787',{waitUntil:'networkidle'});await p.getByRole('heading',{name:/For the love/}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile admin, details save, customer activity, separate anonymous admin gate, registration/login pages, public storefront; zero page errors');
}finally{await browser.close();}
