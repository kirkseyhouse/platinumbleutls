import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';

const runtime='pb-dashboard-runtime@platinum-bleu-drive.iam';
const worker='pb-dashboard-worker@platinum-bleu-drive.iam';
const migration='pb-dashboard-migrate@platinum-bleu-drive.iam';
const tenant='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const sqlFile=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
let fixture;
before(async()=>{
 const seed=new PGlite();
 await seed.exec('CREATE DATABASE platinum_bleu');
 for(const role of [runtime,worker,migration])await seed.exec(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
 fixture=await seed.dumpDataDir();await seed.close();
});
after(()=>{fixture=undefined;});
async function fresh(database='platinum_bleu'){
 return new PGlite({loadDataDir:fixture,database,extensions:{btree_gist}});
}
async function bootstrap(pg){await pg.exec(await sqlFile('deploy/database-bootstrap.sql'));}
async function grants(pg){await pg.exec(await sqlFile('deploy/runtime-role.sql'));}
async function migrate(pg){
 await pg.exec(`SET ROLE "${migration}"; CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`);
 for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
  await pg.exec(await sqlFile('migrations/'+name));
  await pg.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
 }
}

test('bootstrap and owner grants are repeatable and keep both IAM workloads restricted',async()=>{
 const pg=await fresh();
 try{
  await bootstrap(pg);await bootstrap(pg);await migrate(pg);await grants(pg);await grants(pg);
  // A newly created table is deliberately outside the application grant allowlist.
  await pg.exec('CREATE TABLE future_private_table(id integer); RESET ROLE');
  await pg.query("INSERT INTO tenants(id,name,domain) VALUES($1,'One','platinumbleutls.com'),($2,'Two','platinumbleutls.com')",[tenant,other]);
  await pg.query("INSERT INTO customers(tenant_id,name) VALUES($1,'One'),($2,'Two')",[tenant,other]);
  for(const role of [runtime,worker]){
   await pg.exec(`SET SESSION AUTHORIZATION "${role}"`);
   assert.deepEqual((await pg.query('SELECT name FROM customers')).rows,[]);
   await pg.query("SELECT set_config('app.tenant_id',$1,false)",[tenant]);
   assert.deepEqual((await pg.query('SELECT name FROM customers')).rows,[{name:'One'}]);
   await pg.query("INSERT INTO customers(tenant_id,name) VALUES($1,'Allowed')",[tenant]);
   await assert.rejects(pg.query("INSERT INTO customers(tenant_id,name) VALUES($1,'Denied')",[other]),/row-level security/);
   await pg.query("INSERT INTO audit_events(tenant_id,action) VALUES($1,'test')",[tenant]);
   for(const sql of ["UPDATE audit_events SET action='tampered'",'DELETE FROM audit_events','TRUNCATE audit_events','SELECT * FROM schema_migrations',"INSERT INTO schema_migrations(name) VALUES('fake.sql')",'CREATE TABLE forbidden(id int)','CREATE SCHEMA forbidden','CREATE TEMP TABLE forbidden(id int)','ALTER TABLE customers DISABLE ROW LEVEL SECURITY','SELECT * FROM future_private_table',`SET ROLE "${migration}"`,'CREATE ROLE forbidden']){
    await assert.rejects(pg.exec(sql),/permission denied|must be owner/);
   }
   await pg.query("DELETE FROM customers WHERE name='Allowed'");
   await pg.exec("SELECT set_config('app.tenant_id','',false); RESET SESSION AUTHORIZATION");
  }
  const owners=await pg.query("SELECT DISTINCT pg_get_userbyid(relowner) AS owner FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'");
  assert.deepEqual(owners.rows,[{owner:migration}]);
  const memberships=await pg.query("SELECT membership.admin_option FROM pg_auth_members membership JOIN pg_roles granted_role ON granted_role.oid=membership.roleid JOIN pg_roles member_role ON member_role.oid=membership.member WHERE granted_role.rolname='pb_runtime' AND member_role.rolname IN ($1,$2) ORDER BY member_role.rolname",[runtime,worker]);
  assert.deepEqual(memberships.rows,[{admin_option:false},{admin_option:false}]);
 }finally{await pg.close();}
});

test('bootstrap rejects wrong database and missing preprovisioned IAM users atomically',async()=>{
 for(const wrongDatabase of [true,false]){
  const pg=await fresh(wrongDatabase?'template1':'platinum_bleu');
  try{
   if(!wrongDatabase)await pg.exec(`DROP ROLE "${worker}"`);
   await assert.rejects(bootstrap(pg),wrongDatabase?/platinum_bleu/:/preexisting IAM/);
   await pg.exec('ROLLBACK');
   assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname='pb_runtime'")).rows[0].n,0);
  }finally{await pg.close();}
 }
});

test('bootstrap removes preexisting workload schema creation privileges',async()=>{
 const pg=await fresh();
 try{
  await pg.exec(`GRANT CREATE ON SCHEMA public TO "${runtime}"`);
  await bootstrap(pg);
  await pg.exec(`SET SESSION AUTHORIZATION "${runtime}"`);
  await assert.rejects(pg.exec('CREATE TABLE public.unexpected_runtime_table(id int)'),/permission denied/);
 }finally{await pg.close();}
});

test('bootstrap refuses unsafe role flags, membership escalation and existing ownership',async()=>{
 for(const corrupt of [
  'CREATE ROLE pb_runtime NOLOGIN BYPASSRLS',
  `ALTER ROLE "${worker}" CREATEROLE`,
  `GRANT "${migration}" TO "${runtime}"`,
  `CREATE ROLE pb_runtime; GRANT pb_runtime TO "${worker}" WITH ADMIN OPTION`,
  `CREATE TABLE unsafe(id int); ALTER TABLE unsafe OWNER TO "${runtime}"`,
 ]){
  const pg=await fresh();
  try{await pg.exec(corrupt);await assert.rejects(bootstrap(pg),/Unsafe|unsafe/);await pg.exec('ROLLBACK');}
  finally{await pg.close();}
 }
});

test('table grants refuse wrong identity and refuse unexpected inherited audit write access',async()=>{
 const pg=await fresh();
 try{
  await bootstrap(pg);await migrate(pg);await pg.exec('RESET ROLE');
  await assert.rejects(grants(pg),/migration identity/);await pg.exec('ROLLBACK');
  await pg.exec(`SET ROLE "${migration}"; GRANT UPDATE ON audit_events TO PUBLIC`);
  await assert.rejects(grants(pg),/Unsafe|unsafe/);await pg.exec('ROLLBACK');
 }finally{await pg.close();}
});
