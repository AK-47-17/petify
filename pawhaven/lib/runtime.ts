// Node/Vercel runtime. Vite explicitly substitutes runtime.cloudflare.ts for Sites.
import { Pool, types } from 'pg';
import { createDatabase, type Database, type Query } from './database';

let database:Database|undefined;
function getDatabase(){
 if(database)return database;
 const connectionString=process.env.DATABASE_URL;if(!connectionString)return undefined;
 const url=new URL(connectionString);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
 // Keep TLS verification explicit; URL sslmode flags must not weaken it.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
 const pool=new Pool({
  connectionString:url.toString(),max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000,statement_timeout:15000,
  ssl:{rejectUnauthorized:true,...(process.env.SUPABASE_DB_CA_CERT?{ca:process.env.SUPABASE_DB_CA_CERT.replace(/\\n/g,'\n')}:{})},
  types:{getTypeParser(oid,format){if(oid===20)return (value:string)=>{const n=Number(value);if(!Number.isSafeInteger(n))throw new Error('Database integer is outside the supported range.');return n;};return types.getTypeParser(oid,format);}},
 });
 pool.on('error',()=>console.error('Petify database connection interrupted.'));
 const query:Query=(sql,values)=>pool.query(sql,values);
 database=createDatabase({query,async transaction(run){
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await run((sql,values)=>client.query(sql,values));await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
 }});
 return database;
}
export const env={
 get DB(){return getDatabase();},
 get SUPABASE_URL(){return process.env.SUPABASE_URL;},
 get SUPABASE_PUBLISHABLE_KEY(){return process.env.SUPABASE_PUBLISHABLE_KEY;},
 get ADMIN_USER_IDS(){return process.env.ADMIN_USER_IDS;},
 get ADMIN_EMAILS(){return process.env.ADMIN_EMAILS;},
};
