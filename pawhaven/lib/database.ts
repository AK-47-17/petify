export type DatabaseResult<T=Record<string,unknown>> = {results:T[];meta:{changes:number}};
export interface Statement {
 bind(...values:unknown[]):Statement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<DatabaseResult<T>>;
 run<T=Record<string,unknown>>():Promise<DatabaseResult<T>>;
}
export interface Database {
 prepare(sql:string):Statement;
 batch(statements:Statement[]):Promise<DatabaseResult[]>;
}
export type QueryResult={rows:Record<string,unknown>[];rowCount:number|null};
export type Query=(sql:string,values:unknown[])=>Promise<QueryResult>;
export interface DatabaseDriver {query:Query;transaction<T>(run:(query:Query)=>Promise<T>):Promise<T>}

// Keep values separate from SQL. Quoted literals and comments are never rewritten.
export function postgresQuery(sql:string,values:unknown[],previousChanges?:number) {
 let offset=0;const parameters:unknown[]=[];
 const text=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\b(?:FROM|JOIN|INTO|UPDATE)\s+(?:records|customers|rate_limits|record_operations|audit_log)\b|\bchanges\(\)|\?/gi,token=>{
  if(/^(FROM|JOIN|INTO|UPDATE)\s/i.test(token))return token.replace(/\s+/, ' petify.');
  if(token!=='?'&&token!=='changes()')return token;
  if(token==='changes()'&&previousChanges===undefined)throw new Error('changes() requires a transactional batch.');
  const value=token==='?'?values[offset++]:previousChanges;
  if(value!==null&&!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw new Error('Unsupported database parameter.');
  parameters.push(value);return '$'+parameters.length;
 });
 if(offset!==values.length)throw new Error('Database parameter count mismatch.');
 return {text,parameters};
}
export function createDatabase(driver:DatabaseDriver):Database {
 class Prepared implements Statement {
  constructor(readonly sql:string,readonly values:unknown[]=[]){ }
  bind(...values:unknown[]){return new Prepared(this.sql,values);}
  async execute<T>(query:Query,previousChanges?:number):Promise<DatabaseResult<T>> {
   const {text,parameters}=postgresQuery(this.sql,this.values,previousChanges);const result=await query(text,parameters);
   return {results:result.rows as T[],meta:{changes:result.rowCount||0}};
  }
  async first<T>(){return (await this.all<T>()).results[0]??null;}
  all<T>(){return this.execute<T>(driver.query);}
  run<T>(){return this.all<T>();}
 }
 return {
  prepare(sql){return new Prepared(sql);},
  batch(statements){return driver.transaction(async query=>{
   const result:DatabaseResult[]=[];let changes=0;
   for(const statement of statements){if(!(statement instanceof Prepared))throw new Error('A batch must use statements from the same database.');const value=await statement.execute<Record<string,unknown>>(query,changes);result.push(value);changes=value.meta.changes;}
   return result;
  });}
 };
}
