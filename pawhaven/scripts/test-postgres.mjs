import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
await build({entryPoints:['tests/postgres.integration.ts'],outfile:'outputs/postgres-tests.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'local-postgres-runtime',setup(build){
 build.onResolve({filter:/^@\/lib\/runtime$/},()=>({path:resolve('tests/postgres-runtime.ts')}));
 build.onResolve({filter:/^@\/lib\/platform$/},()=>({path:resolve('lib/platform.ts')}));
 build.onResolve({filter:/chatgpt-auth$/},args=>({path:args.path,namespace:'no-platform-auth'}));
 build.onLoad({filter:/.*/,namespace:'no-platform-auth'},()=>({contents:'export async function getChatGPTUser(){return null;}'}));
}}]});
const result=spawnSync(process.execPath,['--test','outputs/postgres-tests.mjs'],{stdio:'inherit'});process.exit(result.status??1);
