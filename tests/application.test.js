import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {hash} from '../src/auth.js';
import {createHmac} from 'node:crypto';
import {drainInbox} from '../src/inbox.js';
let pg,app,db,customer,job,resource,invoice;
const tenant='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',book='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',crew='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const config={origin:'http://localhost:8080',operationalMode:'custom',tenantId:tenant,qboRealmId:'test-realm',qboWebhookKey:'synthetic-verifier-key'};
const client=(method,path,role='owner')=>request(app)[method]('/api/v1'+path).set('Cookie',`__Host-pb_session=${role}-test-secret`).set('Origin',config.origin).set('X-CSRF-Token','csrf-'+role).set('Idempotency-Key',crypto.randomUUID());
before(async()=>{
 pg=new PGlite({extensions:{btree_gist}});await pg.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
 await pg.exec(await readFile(new URL('../migrations/002_connectors.sql',import.meta.url),'utf8'));
 const adapted=client=>({async query(...args){const result=await client.query(...args);return {...result,rowCount:result.rows.length||result.affectedRows||0};}});
 db={...adapted(pg),tx:fn=>pg.transaction(tx=>fn(adapted(tx)))};
 await pg.query('INSERT INTO tenants(id,name,domain) VALUES($1,$2,$3),($4,$5,$3)',[tenant,'Test business','platinumbleutls.com',other,'Other isolated tenant']);
 for(const [key,memberId,roles] of [['owner',owner,['owner']],['book',book,['bookkeeper']],['crew',crew,['crew']]]){
  await pg.query('INSERT INTO members(id,tenant_id,email,name,subject,roles) VALUES($1,$2,$3,$4,$5,$6)',[memberId,tenant,key+'@platinumbleutls.com',key,'verified-test-'+key,roles]);
  await pg.query("INSERT INTO sessions(token_hash,member_id,csrf,permission_version,expires_at) VALUES($1,$2,$3,1,now()+interval '1 hour')",[hash(key+'-test-secret'),memberId,'csrf-'+key]);
 }
 app=createApp({db,config});
});
after(async()=>{await pg?.close();});
test('anonymous and forged headers cannot access data; missing OAuth fails closed',async()=>{
 assert.equal((await request(app).get('/api/v1/jobs').set('x-user-role','owner')).status,401);
 assert.equal((await request(app).get('/auth/google')).status,503);
 assert.equal((await request(app).get('/auth/google/callback?code=x&state=y')).status,503);
 for(const path of ['/auth/password','/auth/magic-link','/signin-with-chatgpt','/dev/login'])assert.equal((await request(app).get(path)).status,404);
});
test('verified webhooks are durably deduped and failed processing retries safely',async()=>{
 const body=JSON.stringify({eventNotifications:[{realmId:'test-realm',dataChangeEvent:{entities:[]}}]}),signature=createHmac('sha256',config.qboWebhookKey).update(body).digest('base64');
 for(let i=0;i<2;i++)assert.equal((await request(app).post('/webhooks/quickbooks').set('content-type','application/json').set('intuit-signature',signature).send(body)).status,204);
 assert.equal((await pg.query('SELECT * FROM webhook_inbox')).rows.length,1);
 assert.equal((await request(app).post('/webhooks/quickbooks').set('content-type','application/json').set('intuit-signature','bad').send(body)).status,401);
 await drainInbox(db,config,async()=>{throw Error('Provider outage');});let row=(await pg.query('SELECT * FROM webhook_inbox')).rows[0];assert.equal(row.status,'retry');assert.equal(row.attempts,1);
 await pg.query("UPDATE webhook_inbox SET next_attempt_at=now()-interval '1 minute'");let calls=0;await drainInbox(db,config,async()=>{calls++;});await drainInbox(db,config,async()=>{calls++;});assert.equal(calls,1);assert.equal((await pg.query('SELECT status FROM webhook_inbox')).rows[0].status,'done');
});
test('owner creates customer; CSRF and idempotency protect writes',async()=>{
 const csrf=await client('post','/customers').set('X-CSRF-Token','wrong').send({name:'Sample'});assert.equal(csrf.status,403);
 const key=crypto.randomUUID(),payload={name:'Sample Client',email:'sample@example.invalid',phone:'4795550123',address:'Synthetic address'};
 let result=await client('post','/customers').set('Idempotency-Key',key).send(payload);assert.equal(result.status,200,JSON.stringify(result.body));customer=result.body;
 result=await client('post','/customers').set('Idempotency-Key',key).send(payload);assert.equal(result.body.id,customer.id);
 assert.equal((await client('post','/customers').set('Idempotency-Key',key).send({...payload,name:'Changed'})).status,409);
 assert.equal((await client('post','/customers').send(payload)).status,409);
});
test('role permissions restrict jobs, invoices, and customer fields',async()=>{
 assert.equal((await client('post','/jobs','book').send({customer_id:customer.id,title:'Tree work'})).status,403);
 assert.equal((await client('get','/invoices','crew')).status,403);
 assert.equal((await client('get','/customers','book')).body[0].phone,undefined);
 const result=await client('post','/jobs').send({customer_id:customer.id,title:'Synthetic tree removal'});assert.equal(result.status,200,JSON.stringify(result.body));job=result.body;
 assert.deepEqual((await client('get','/jobs','crew')).body,[]);
});
test('scheduling enforces approval and deposit, then prevents overlap',async()=>{
 resource=(await client('post','/resources').send({name:'Test crew member',kind:'person'})).body;
 const booking={version:1,starts_at:'2026-10-07T14:00:00Z',ends_at:'2026-10-07T18:00:00Z',resource_ids:[resource.id]};
 assert.equal((await client('post',`/jobs/${job.id}/schedule`).send(booking)).status,422);
 let approved=await client('post',`/jobs/${job.id}/approve`).send({version:1,agreement_at:'2026-09-15T12:00:00Z',deposit_required_minor:50000,deposit_paid_minor:50000});assert.equal(approved.status,200,JSON.stringify(approved.body));
 assert.equal((await client('post',`/jobs/${job.id}/schedule`).send({...booking,version:2})).status,200);
 const second=(await client('post','/jobs').send({customer_id:customer.id,title:'Overlapping test'})).body;
 await client('post',`/jobs/${second.id}/approve`).send({version:1,agreement_at:'2026-09-15T12:00:00Z',deposit_required_minor:0,deposit_paid_minor:0});
 assert.equal((await client('post',`/jobs/${second.id}/schedule`).send({...booking,version:2})).status,409);
});
test('invoice totals are calculated and issued revisions cannot be altered',async()=>{
 const result=await client('post','/invoices','book').send({job_id:job.id,number:'TEST-1',due_date:'2026-10-10',lines:[{description:'Test work',quantity:2,unit_minor:25000,tax_minor:1000}]});assert.equal(result.status,200,JSON.stringify(result.body));invoice=result.body;assert.equal(Number(invoice.total_minor),51000);
 assert.equal((await client('post',`/invoices/${invoice.id}/approve`,'book').send({version:1})).status,403);
 assert.equal((await client('post',`/invoices/${invoice.id}/approve`).send({version:1})).status,200);
 await pg.query("UPDATE invoices SET status='issued' WHERE id=$1",[invoice.id]);
 await assert.rejects(pg.query('UPDATE invoices SET total_minor=1 WHERE id=$1',[invoice.id]),/immutable/);
});
test('import staging and retries create one copy of exact duplicate contacts',async()=>{
 const stage=await client('post','/imports').send({rows:[{name:'New import',email:'new@example.invalid'},{name:'Same import',email:'new@example.invalid'},{name:'Existing',email:'sample@example.invalid'}]});assert.equal(stage.status,200,JSON.stringify(stage.body));
 const commit=await client('post',`/imports/${stage.body.id}/commit`).send({});assert.equal(commit.body.created,1);assert.equal(commit.body.skipped,2);
 assert.equal((await client('post',`/imports/${stage.body.id}/commit`).send({})).body.created,0);
});
test('row security denies other tenant and composite foreign keys block cross-tenant linkage',async()=>{
 await pg.exec('CREATE ROLE test_runtime; GRANT USAGE ON SCHEMA public TO test_runtime; GRANT SELECT,INSERT ON customers,jobs TO test_runtime;');
 await pg.query('INSERT INTO customers(tenant_id,name) VALUES($1,$2)',[other,'Hidden other tenant']);
 await pg.transaction(async tx=>{await tx.exec('SET LOCAL ROLE test_runtime');await tx.query("select set_config('app.tenant_id',$1,true)",[tenant]);const result=await tx.query('SELECT name FROM customers');assert.ok(result.rows.length>0);assert.ok(!result.rows.some(r=>r.name==='Hidden other tenant'));});
 await assert.rejects(pg.query('INSERT INTO jobs(tenant_id,customer_id,title) VALUES($1,$2,$3)',[other,customer.id,'Invalid cross tenant']),/foreign key/);
});
test('suspension revokes existing sessions immediately',async()=>{
 assert.equal((await client('post',`/members/${book}/suspend`).send({})).status,200);
 assert.equal((await client('get','/invoices','book')).status,401);
});
test('job lifecycle preserves reservations until completion and rejects illegal transitions',async()=>{
 const transition=async(status,version,role='owner')=>client('post',`/jobs/${job.id}/status`,role).send({status,version});
 assert.equal((await transition('complete',3)).status,409);
 assert.equal((await transition('in_progress',3,'crew')).status,404);
 await pg.query('INSERT INTO assignments(tenant_id,job_id,member_id) VALUES($1,$2,$3)',[tenant,job.id,crew]);
 assert.equal((await transition('in_progress',3,'crew')).status,200);
 assert.equal((await transition('complete',3)).status,409);
 assert.equal((await transition('complete',4,'crew')).status,200);
 assert.equal((await pg.query("SELECT count(*)::int AS n FROM reservations WHERE job_id=$1 AND status='confirmed'",[job.id])).rows[0].n,0);
 assert.equal((await transition('in_progress',5)).status,409);
});
test('summary counts all records and does not expose finances to crews',async()=>{
 await pg.query("INSERT INTO jobs(tenant_id,customer_id,title) SELECT $1,$2,'Synthetic bulk job '||n FROM generate_series(1,205) n",[tenant,customer.id]);
 const summary=await client('get','/summary');assert.equal(summary.status,200);assert.equal(summary.body.jobs.awaiting_approval,205);
 const crewSummary=await client('get','/summary','crew');assert.equal(crewSummary.status,200);assert.equal(crewSummary.body.invoices,null);assert.equal(crewSummary.body.jobs.total,1);
});
test('coexistence mode prevents custom scheduling and lifecycle commands',async()=>{
 const old=config.operationalMode;config.operationalMode='hcp_coexistence';try{assert.equal((await client('post',`/jobs/${job.id}/status`).send({status:'canceled',version:5})).status,409);}finally{config.operationalMode=old;}
});
test('operations assigns active members and revoking assignment removes crew visibility',async()=>{
 const current=(await pg.query('SELECT version FROM jobs WHERE id=$1',[job.id])).rows[0].version;
 assert.equal((await client('put',`/jobs/${job.id}/assignments`,'crew').send({version:current,member_ids:[]})).status,403);
 const result=await client('put',`/jobs/${job.id}/assignments`).send({version:current,member_ids:[]});assert.equal(result.status,200,JSON.stringify(result.body));
 assert.deepEqual((await client('get','/jobs','crew')).body,[]);
 assert.equal((await client('put',`/jobs/${job.id}/assignments`).send({version:result.body.version,member_ids:[book]})).status,422);
});
test('invoice editing rejects approved or issued revisions',async()=>{
 const draft=(await client('post','/invoices').send({job_id:job.id,number:'EDIT-TEST',due_date:'2026-10-10',lines:[{description:'Test',quantity:1,unit_minor:10000,tax_minor:0}]})).body;
 const payload={version:1,due_date:'2026-10-11',lines:[{description:'Updated test',quantity:2,unit_minor:10000,tax_minor:0}]};
 const updated=await client('patch',`/invoices/${draft.id}`).send(payload);assert.equal(updated.status,200,JSON.stringify(updated.body));assert.equal(Number(updated.body.total_minor),20000);
 assert.equal((await client('patch',`/invoices/${draft.id}`).send(payload)).status,409);
 await client('post',`/invoices/${draft.id}/approve`).send({version:2});
 assert.equal((await client('patch',`/invoices/${draft.id}`).send({...payload,version:3})).status,409);
});

test('HCP refresh publishes atomically and preserves data on pagination or mapping failure',async()=>{
 const {synchronize}=await import('../src/sync.js');const originalFetch=globalThis.fetch;
 const cfg={tenantId:tenant,hcpCompanyId:'synthetic-company',hcpKey:'synthetic-key'};
 let mode='valid';
 globalThis.fetch=async input=>{
  const url=new URL(input);let body;
  if(url.pathname==='/company')body={id:cfg.hcpCompanyId};
  else if(url.pathname==='/customers')body={page:1,total_pages:1,total_items:1,customers:[{id:'hcp-customer',first_name:mode==='valid'?'Original':'Unpublished'}]};
  else if(mode==='pagination')body={page:1,total_pages:1,total_items:2,jobs:[]};
  else body={page:1,total_pages:1,total_items:1,jobs:[{id:'hcp-job',name:'Synthetic HCP work',...(mode==='mapping'?{}:{customer:{id:'hcp-customer',first_name:'Original'}})}]};
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  assert.deepEqual(await synchronize(db,cfg,'housecall'),{processed:2});
  const prior=(await pg.query("SELECT last_success_at FROM connections WHERE tenant_id=$1 AND provider='housecall'",[tenant])).rows[0].last_success_at;
  for(const failure of ['pagination','mapping']){
   mode=failure;await assert.rejects(()=>synchronize(db,cfg,'housecall'));
   assert.equal((await pg.query("SELECT name FROM customers WHERE tenant_id=$1 AND external_id='hcp-customer'",[tenant])).rows[0].name,'Original');
   assert.equal((await pg.query("SELECT data->>'first_name' AS name FROM external_snapshots WHERE tenant_id=$1 AND provider='housecall' AND entity_type='customers'",[tenant])).rows[0].name,'Original');
   assert.equal(String((await pg.query("SELECT last_success_at FROM connections WHERE tenant_id=$1 AND provider='housecall'",[tenant])).rows[0].last_success_at),String(prior));
  }
 }finally{globalThis.fetch=originalFetch;}
});
