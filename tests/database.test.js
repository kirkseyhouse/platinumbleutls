import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase} from '../src/db.js';

const production=(purpose='runtime')=>({NODE_ENV:'production',INSTANCE_CONNECTION_NAME:'platinum-bleu-drive:us-central1:pb-prod-sql',DB_NAME:'platinum_bleu',DB_IAM_USER:`pb-dashboard-${purpose==='migration'?'migrate':purpose}@platinum-bleu-drive.iam`});
// Cloud APIs and TCP connections are external boundaries. The SQL tests below
// execute the role guard itself against PostgreSQL (PGlite).
function boundary({query,optionsError,endError,connectError}={}){
 const calls={closed:0,ended:0,released:[],sql:[]};
 class Connector{
  async getOptions(options){calls.connector=options;if(optionsError)throw optionsError;return {stream:()=>{}};}
  close(){calls.closed++;}
 }
 class Pool extends EventEmitter{
  constructor(options){super();calls.pool=options;calls.instance=this;}
  async query(sql,args){calls.sql.push(sql);return query?query(sql,args):{rows:[{current_user:calls.pool.user,session_user:calls.pool.user,unsafe:false}]};}
  async connect(){if(connectError)throw connectError;return {query:this.query.bind(this),release:error=>calls.released.push(error)};}
  async end(){calls.ended++;if(endError)throw endError;}
 }
 return {calls,dependencies:{Connector,Pool}};
}

test('production rejects incomplete, misrouted and password configuration before opening resources',async()=>{
 for(const change of [{INSTANCE_CONNECTION_NAME:undefined},{INSTANCE_CONNECTION_NAME:'other:us-central1:pb-prod-sql'},{DB_NAME:'postgres'},{DB_IAM_USER:'pb-dashboard-migrate@platinum-bleu-drive.iam'},{DB_IAM_USER:'pb-dashboard-runtime@platinum-bleu-drive.iam.gserviceaccount.com'},{DATABASE_URL:'postgres://unused'},{MIGRATION_DATABASE_URL:'postgres://unused'},{PGPASSWORD:'unused'},{PGHOST:'public.example'}]){
  const {calls,dependencies}=boundary();
  await assert.rejects(async()=>createDatabase({env:{...production(),...change},purpose:'runtime'},dependencies));
  assert.equal(calls.pool,undefined);assert.equal(calls.connector,undefined);
 }
 for(const purpose of [undefined,'admin'])await assert.rejects(async()=>createDatabase({env:production(),purpose},boundary().dependencies));
});
test('all production purposes use automatic IAM, private IP, bounded pools and their exact login',async()=>{
 for(const purpose of ['runtime','worker','migration']){
  const {calls,dependencies}=boundary();
  const db=await createDatabase({env:production(purpose),purpose},dependencies);
  assert.deepEqual(calls.connector,{instanceConnectionName:'platinum-bleu-drive:us-central1:pb-prod-sql',ipType:'PRIVATE',authType:'IAM'});
  assert.equal(calls.pool.user,production(purpose).DB_IAM_USER);assert.equal(calls.pool.database,'platinum_bleu');
  assert.equal(calls.pool.max,5);assert.equal(calls.pool.connectionTimeoutMillis,5000);assert.equal(calls.pool.password,undefined);
  await db.close();await db.close();assert.equal(calls.ended,1);assert.equal(calls.closed,1);
 }
});
test('development supports local URLs and demo mode but deployed workloads cannot downgrade auth',async()=>{
 assert.equal(await createDatabase({env:{NODE_ENV:'development'},purpose:'runtime'}),null);
 const {calls,dependencies}=boundary();
 const db=await createDatabase({env:{DATABASE_URL:'postgres://localhost/local'},purpose:'runtime'},dependencies);
 assert.equal(calls.pool.connectionString,'postgres://localhost/local');assert.equal(calls.connector,undefined);await db.close();
 for(const env of [{NODE_ENV:'staging',DATABASE_URL:'postgres://localhost/local'},{K_SERVICE:'deployed'},{CLOUD_RUN_JOB:'deployed'}])await assert.rejects(async()=>createDatabase({env,purpose:'runtime'},boundary().dependencies));
});
test('failed connector initialization and rejected identity both clean up resources',async()=>{
 const unavailable=boundary({optionsError:new Error('private token detail')});
 await assert.rejects(async()=>createDatabase({env:production(),purpose:'runtime'},unavailable.dependencies),error=>!error.message.includes('private token detail'));
 assert.equal(unavailable.calls.closed,1);assert.equal(unavailable.calls.ended,0);
 for(const row of [undefined,{current_user:'wrong',session_user:'wrong',unsafe:false},{current_user:production().DB_IAM_USER,session_user:production().DB_IAM_USER,unsafe:true}]){
  const {calls,dependencies}=boundary({query:async()=>({rows:row?[row]:[]})});
  await assert.rejects(async()=>createDatabase({env:production(),purpose:'runtime'},dependencies));
  assert.equal(calls.ended,1);assert.equal(calls.closed,1);
 }
});
test('pool query failure closes resources; connector closes even when pool end fails',async()=>{
 const failing=boundary({query:async()=>{throw new Error('connection lost');}});
 await assert.rejects(async()=>createDatabase({env:production(),purpose:'runtime'},failing.dependencies));
 assert.equal(failing.calls.ended,1);assert.equal(failing.calls.closed,1);
 const {calls,dependencies}=boundary({endError:new Error('end failed')});
 const db=await createDatabase({env:production(),purpose:'runtime'},dependencies);
 await assert.rejects(()=>db.close());assert.equal(calls.closed,1);
});
test('idle connection failures are handled without logging the connection error or credentials',async()=>{
 const {calls,dependencies}=boundary(),logs=[];
 const original=console.error;console.error=(...values)=>logs.push(values.join(' '));
 try{
  const db=await createDatabase({env:production(),purpose:'runtime'},dependencies);
  calls.instance.emit('error',new Error('postgres://secret@host private-token'));
  assert.equal(logs.length,1);assert.match(logs[0],/database/);assert.doesNotMatch(logs[0],/secret|private-token/);await db.close();
 }finally{console.error=original;}
});
test('transactions commit results and roll back failures while releasing clients',async()=>{
 const {calls,dependencies}=boundary();
 const db=await createDatabase({env:{DATABASE_URL:'postgres://localhost/local'},purpose:'runtime'},dependencies);
 calls.sql.length=0;
 assert.equal(await db.tx(async client=>{await client.query('SELECT 42');return 42;}),42);
 assert.deepEqual(calls.sql,['BEGIN','SELECT 42','COMMIT']);assert.equal(calls.released.length,1);
 const original=new Error('operation failed');calls.sql.length=0;
 await assert.rejects(()=>db.tx(async()=>{throw original;}),error=>error===original);
 assert.deepEqual(calls.sql,['BEGIN','ROLLBACK']);assert.equal(calls.released.length,2);await db.close();
});
test('rollback failure preserves the original error and discards the broken client',async()=>{
 const rollbackError=new Error('connection lost'),original=new Error('operation failed');
 const {calls,dependencies}=boundary({query:async sql=>{if(sql==='ROLLBACK')throw rollbackError;return {rows:[]};}});
 const db=await createDatabase({env:{DATABASE_URL:'postgres://localhost/local'},purpose:'runtime'},dependencies);
 await assert.rejects(()=>db.tx(async()=>{throw original;}),error=>error===original);
 assert.deepEqual(calls.released,[rollbackError]);await db.close();
});
test('pool acquisition failure propagates without running a transaction',async()=>{
 const {calls,dependencies}=boundary({connectError:new Error('pool exhausted')});
 const db=await createDatabase({env:{DATABASE_URL:'postgres://localhost/local'},purpose:'runtime'},dependencies);
 await assert.rejects(()=>db.tx(()=>assert.fail('transaction must not start')),/pool exhausted/);
 assert.equal(calls.released.length,0);await db.close();
});
test('runtime and worker role guard rejects inherited owner, bypass, superuser and migration membership',async()=>{
 const pg=new PGlite();
 const runtime='pb-dashboard-runtime@platinum-bleu-drive.iam',worker='pb-dashboard-worker@platinum-bleu-drive.iam',migration='pb-dashboard-migrate@platinum-bleu-drive.iam';
 try{
  await pg.exec(`CREATE ROLE "${runtime}" LOGIN; CREATE ROLE "${worker}" LOGIN; CREATE ROLE "${migration}" LOGIN; CREATE ROLE bridge NOLOGIN; CREATE ROLE unsafe_role NOLOGIN; CREATE TABLE public.role_guard_fixture(id int); GRANT CONNECT ON DATABASE postgres TO "${runtime}", "${worker}";`);
  for(const purpose of ['runtime','worker']){
   const user=purpose==='runtime'?runtime:worker;
   const run=async()=>{
    const {dependencies}=boundary({query:(sql,args)=>pg.query(sql,args)});
    await pg.exec(`SET SESSION AUTHORIZATION "${user}"`);
    try{return await createDatabase({env:production(purpose),purpose},dependencies);}finally{await pg.exec('SET SESSION AUTHORIZATION postgres');}
   };
   await (await run()).close();
   for(const unsafe of [
    `ALTER ROLE "${user}" BYPASSRLS`,
    `ALTER ROLE "${user}" CREATEROLE`,
    `ALTER ROLE "${user}" CREATEDB`,
    `ALTER ROLE "${user}" REPLICATION`,
    `GRANT unsafe_role TO "${user}"; ALTER ROLE unsafe_role BYPASSRLS`,
    `GRANT unsafe_role TO "${user}"; ALTER ROLE unsafe_role SUPERUSER`,
    `GRANT unsafe_role TO "${user}"; ALTER ROLE unsafe_role CREATEROLE`,
    `GRANT unsafe_role TO "${user}"; ALTER ROLE unsafe_role CREATEDB`,
    `GRANT unsafe_role TO "${user}"; ALTER ROLE unsafe_role REPLICATION`,
    `GRANT bridge TO "${user}"; GRANT "${migration}" TO bridge`,
    `ALTER TABLE public.role_guard_fixture OWNER TO unsafe_role; GRANT unsafe_role TO "${user}"`,
    `ALTER SCHEMA public OWNER TO unsafe_role; GRANT unsafe_role TO "${user}"`,
    `GRANT CREATE ON SCHEMA public TO "${user}"`,
    `GRANT CREATE ON SCHEMA public TO unsafe_role; GRANT unsafe_role TO "${user}" WITH INHERIT FALSE, SET TRUE`,
   ]){
    await pg.exec('BEGIN');
    try{await pg.exec(unsafe);await assert.rejects(run,/database role/i,unsafe);}finally{await pg.exec('ROLLBACK');}
   }
 }
 }finally{await pg.close();}
});
test('migration role guard rejects direct and inherited elevated flags',async()=>{
 const pg=new PGlite();
 const migration='pb-dashboard-migrate@platinum-bleu-drive.iam';
 try{
  await pg.exec(`CREATE ROLE "${migration}" LOGIN; CREATE ROLE elevated NOLOGIN`);
  const run=async()=>{
   const {dependencies}=boundary({query:(sql,args)=>pg.query(sql,args)});
   await pg.exec(`SET SESSION AUTHORIZATION "${migration}"`);
   try{return await createDatabase({env:production('migration'),purpose:'migration'},dependencies);}finally{await pg.exec('SET SESSION AUTHORIZATION postgres');}
  };
  await (await run()).close();
  for(const unsafe of [
   `ALTER ROLE "${migration}" SUPERUSER`,
   `ALTER ROLE "${migration}" BYPASSRLS`,
   `ALTER ROLE "${migration}" CREATEROLE`,
   `ALTER ROLE "${migration}" CREATEDB`,
   `ALTER ROLE "${migration}" REPLICATION`,
   `GRANT elevated TO "${migration}"; ALTER ROLE elevated CREATEROLE`
  ]){
   await pg.exec('BEGIN');
   try{await pg.exec(unsafe);await assert.rejects(run,/database role/i,unsafe);}finally{await pg.exec('ROLLBACK');}
  }
 }finally{await pg.close();}
});
test('all workload guards reject direct and set-role database creation privileges',async()=>{
 const seed=new PGlite();
 await seed.exec('CREATE DATABASE platinum_bleu');
 const fixture=await seed.dumpDataDir();
 await seed.close();
 for(const purpose of ['runtime','worker','migration'])for(const reachable of [false,true]){
  const pg=new PGlite({loadDataDir:fixture,database:'platinum_bleu'});
  const user=production(purpose).DB_IAM_USER;
  try{
   await pg.exec(`CREATE ROLE "${user}" LOGIN; CREATE ROLE database_creator NOLOGIN`);
   const databaseName=(await pg.query('SELECT current_database() AS name')).rows[0].name;
   if(reachable)await pg.exec(`GRANT CREATE ON DATABASE "${databaseName}" TO database_creator; GRANT database_creator TO "${user}" WITH INHERIT FALSE, SET TRUE`);
   else await pg.exec(`GRANT CREATE ON DATABASE "${databaseName}" TO "${user}"`);
   const {dependencies}=boundary({query:(sql,args)=>pg.query(sql,args)});
   await pg.exec(`SET SESSION AUTHORIZATION "${user}"`);
   await assert.rejects(()=>createDatabase({env:production(purpose),purpose},dependencies),/database role/i,`${purpose} reachable=${reachable}`);
  }finally{await pg.close();}
 }
});
