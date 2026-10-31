import { NextRequest, NextResponse } from 'next/server';
import { chatGPTAuthEnabled } from '@/lib/platform';

export function proxy(request:NextRequest){
 // Sites already applies its own trusted ingress and nonce policy.
 if(chatGPTAuthEnabled)return NextResponse.next();
 const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
 const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV==='development'?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`;
 const headers=new Headers(request.headers);
 for(const key of [...headers.keys()])if(key.startsWith('oai-authenticated-'))headers.delete(key);
 headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
 const response=NextResponse.next({request:{headers}});
 response.headers.set('Content-Security-Policy',csp);
 response.headers.set('X-Content-Type-Options','nosniff');
 response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 response.headers.set('Cache-Control','private, no-store');
 if(request.nextUrl.protocol==='https:')response.headers.set('Strict-Transport-Security','max-age=31536000');
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|images/|fonts/|favicon.svg).*)']};
