import {PGlite, type Transaction} from '@electric-sql/pglite';
import {createDatabase, type Query} from '../lib/database';
export const engine=new PGlite({parsers:{20:Number}});
const queryFor=(db:PGlite|Transaction):Query=>async(sql,values)=>{const result=await db.query<Record<string,unknown>>(sql,values);return {rows:result.rows,rowCount:result.affectedRows??result.rows.length};};
export const database=createDatabase({query:queryFor(engine),transaction:run=>engine.transaction(tx=>run(queryFor(tx)))});
export const env={DB:database,SUPABASE_URL:'https://qa.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public-key',ADMIN_EMAILS:'owner@example.test',ADMIN_USER_IDS:''};
