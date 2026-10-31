import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/security.test.ts'],outfile:'outputs/security-tests.mjs',bundle:true,platform:'node',format:'esm'});
const result=spawnSync(process.execPath,['--test','outputs/security-tests.mjs'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
await build({entryPoints:['tests/auth.test.ts'],outfile:'outputs/auth-tests.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-auth-runtime',setup(build){
 build.onResolve({filter:/^(@\/lib\/runtime)$|chatgpt-auth$/},args=>({path:args.path,namespace:'test-runtime'}));
 build.onLoad({filter:/.*/,namespace:'test-runtime'},args=>({contents:args.path==='@/lib/runtime'?`export const env={SUPABASE_URL:'https://qa.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public-key',ADMIN_EMAILS:'owner@example.test',DB:{prepare(){return {bind(){return {async first(){return {count:1}}}}}}}};`:`export async function getChatGPTUser(){return null;}`}));
}}]});
const auth=spawnSync(process.execPath,['--test','outputs/auth-tests.mjs'],{stdio:'inherit'});process.exit(auth.status??1);
