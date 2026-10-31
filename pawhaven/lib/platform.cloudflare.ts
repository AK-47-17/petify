// Only this build runs behind the Sites ingress that verifies these identities.
export const chatGPTAuthEnabled=true;
export const clientAddress=(req:Request)=>req.headers.get('cf-connecting-ip')||'local';
