import { env as workerEnv } from 'cloudflare:workers';
import type {Database} from './database';
type Settings={SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string;ADMIN_USER_IDS?:string;ADMIN_EMAILS?:string};
export const env={
 get DB():Database|undefined{const db=workerEnv.DB;return db?{prepare:sql=>db.prepare(sql),batch:statements=>db.batch(statements as D1PreparedStatement[])}:undefined;},
 get SUPABASE_URL(){return (workerEnv as Settings).SUPABASE_URL;},
 get SUPABASE_PUBLISHABLE_KEY(){return (workerEnv as Settings).SUPABASE_PUBLISHABLE_KEY;},
 get ADMIN_USER_IDS(){return (workerEnv as Settings).ADMIN_USER_IDS;},
 get ADMIN_EMAILS(){return (workerEnv as Settings).ADMIN_EMAILS;},
};
