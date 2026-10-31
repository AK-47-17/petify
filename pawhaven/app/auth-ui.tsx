'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { PawPrint, ArrowLeft, ArrowRight, ShieldCheck, Eye, EyeOff, LoaderCircle } from 'lucide-react';

export async function signOut(provider?:string) {
 const response=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 if(!response.ok)throw new Error('Could not sign out. Please try again.');
 window.location.href=provider==='email'?'/':'/signout-with-chatgpt?return_to=/';
}
export default function AuthUI({initial='login'}:{initial?:string}) {
 const [mode,setMode]=useState(initial),[email,setEmail]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState<boolean|null>(null),[chatGPTEnabled,setChatGPTEnabled]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[verifyType,setVerifyType]=useState('signup'),[returnTo,setReturnTo]=useState('/account');
 useEffect(()=>{const p=new URLSearchParams(location.search).get('return_to');if(p&&['/account','/admin','/services','/shop','/adopt','/'].includes(p))setReturnTo(p);fetch('/api/session').then(r=>{if(!r.ok)throw new Error();return r.json() as Promise<{emailAuthReady:boolean;chatGPTAuthEnabled:boolean}>}).then(r=>{setReady(r.emailAuthReady);setChatGPTEnabled(r.chatGPTAuthEnabled)}).catch(()=>{setReady(false);setError('Sign-in settings could not be loaded. Please refresh to try again.');});if(location.hash)history.replaceState(null,'',location.pathname+location.search);},[]);
 function switchMode(next:string){setMode(next);setError('');setMessage('');}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');const form=Object.fromEntries(new FormData(e.currentTarget));if(mode==='verify')form.type=verifyType;
 try{const response=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const data=await response.json() as {error?:string;message:string;recovery?:boolean};if(!response.ok)throw new Error(data.error||'Unable to continue. Please try again.');
 if(mode==='login'||mode==='verify'&&!data.recovery)window.location.assign(returnTo);
 else if(mode==='verify'){setMode('password');setMessage('Email verified. Choose your new password.');}
 else if(mode==='recover'){setVerifyType('recovery');setMode('verify');setMessage(data.message);}
 else if(mode==='register'){setVerifyType('signup');setMode('verify');setMessage(data.message);}
 else if(mode==='password'){setMode('login');setMessage(data.message);}
 else setMessage(data.message);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const title:Record<string,string>={login:'Welcome back, pet parent.',register:'A little more happy starts here.',recover:'Let’s get you back in.',verify:'Check your inbox.',password:'A fresh start.'};
 return <main className="auth-shell"><section className="auth-story"><a className="logo" href="/"><PawPrint size={32}/><span>petify.</span></a><div><span className="eyebrow">YOUR PET’S HAPPY PLACE</span><h1>All their care.<br/>One little corner.</h1><p>Save your companions, plan their next pamper day, and keep every request close.</p><img src="/images/hero.jpg" alt="Happy golden retriever"/></div><span><ShieldCheck size={18}/> Thoughtful care starts with trust.</span></section><section className="auth-main"><a className="text-link" href="/"><ArrowLeft size={17}/> Keep exploring Petify</a><div className="auth-card"><span className="eyebrow">{returnTo==='/admin'?'PETIFY ADMINISTRATOR':'HELLO, YOU'}</span><h2>{title[mode]}</h2><p>{mode==='register'?'Create your account with your email address.':mode==='verify'?'Enter the confirmation code from your email. If the email has a confirmation link, open it and then sign in.':mode==='recover'?'We’ll send recovery instructions to your email.':mode==='password'?'Choose at least 12 characters.':'Sign in to manage your pets and requests.'}</p>
 {ready===false&&<div className="auth-info">Email sign-in is being connected. You can explore the website freely while account setup is completed.</div>}
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="auth-info" role="status">{message}</p>}
 <form onSubmit={submit} key={mode}>
 {mode==='register'&&<label className="field"><span>Your name</span><input required name="name" autoComplete="name" minLength={2} maxLength={100}/></label>}
 {mode!=='password'&&<label className="field"><span>Email address</span><input required type="email" name="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
 {['login','register','password'].includes(mode)&&<label className="field"><span>Password</span><span className="password-field"><input required type={show?'text':'password'} name="password" minLength={mode==='login'?1:12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Hide password':'Show password'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>}
 {mode==='verify'&&<label className="field"><span>Email confirmation code</span><input required name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10}/></label>}
 {mode==='register'&&<label className="consent"><input type="checkbox" required/><span>I agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy notice</a>.</span></label>}
 <button disabled={busy||ready!==true} className="button green auth-submit">{busy?<LoaderCircle className="spin" size={18}/>:null}{mode==='register'?'Create account':mode==='recover'?'Send recovery email':mode==='verify'?'Verify email':mode==='password'?'Save new password':'Sign in'}<ArrowRight size={17}/></button></form>
 <div className="auth-options">{mode==='login'?<><button onClick={()=>switchMode('recover')}>Forgot your password?</button><span>New to Petify? <a href={'/register?return_to='+encodeURIComponent(returnTo)}>Create an account</a></span></>:<button onClick={()=>switchMode('login')}>Already confirmed? Back to sign in</button>}{mode==='verify'&&<button disabled={busy||!ready} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/auth/'+(verifyType==='recovery'?'recover':'resend'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json() as {error:string;message:string};if(!r.ok)throw new Error(d.error);setMessage(d.message);}catch(e){setError((e as Error).message)}finally{setBusy(false);}}}>Resend email</button>}</div>
 {chatGPTEnabled&&<><div className="auth-divider"><span>or</span></div><a className="button outline auth-submit" href={'/signin-with-chatgpt?return_to='+encodeURIComponent(returnTo)} target="_top">Continue with ChatGPT</a></>}<p className="auth-footnote">Just looking around? Our services, shop and journal are open to everyone.</p></div></section></main>;
}
