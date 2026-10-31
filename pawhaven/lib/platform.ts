// No visitor-supplied identity header is trusted on Vercel or self-hosted Next.js.
export const chatGPTAuthEnabled=false;
export const clientAddress=(req:Request)=>process.env.VERCEL==='1'?(req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown'):'local';
