import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authRoutes, sessionMiddleware, csrfMiddleware, hash } from './auth.js';
import { tenantTx, audit } from './db.js';
import { fail, requirePermission, allowed, restricted, normalizeContact, calculateInvoice, scheduleGate } from './domain.js';
import {connectorRoutes} from './connectors.js';
import {webhookRoutes} from './webhooks.js';
import {readOperatingCommandCenter} from './notion.js';

const uuid=z.string().uuid(),text=z.string().trim().min(1).max(250);
const optionalText=z.string().trim().max(2000).nullish();
const contactSchema=z.object({name:text,email:optionalText,phone:optionalText,address:optionalText}).strict();
const parse=(schema,input)=>{const result=schema.safeParse(input);if(!result.success)fail(422,result.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));return result.data;};
const id=req=>parse(uuid,req.params.id);
const bound=(actor,alias='j')=>restricted(actor)?` AND EXISTS(SELECT 1 FROM assignments a WHERE a.tenant_id=${alias}.tenant_id AND a.job_id=${alias}.id AND a.member_id=$2)` : '';
const params=actor=>restricted(actor)?[actor.tenant_id,actor.id]:[actor.tenant_id];

export function createApp({db,config}){
 const app=express();app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],frameAncestors:["'none'"],formAction:["'self'"],upgradeInsecureRequests:null}}}));
 app.use((req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('X-Request-ID',randomUUID());next();});
 app.use('/auth',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false}));
 app.use('/webhooks',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false}));
 webhookRoutes(app,{db,config});
 app.use(express.json({limit:'1mb'}));
 app.get('/healthz',(req,res)=>res.json({status:'ok'}));
 app.get('/readyz',async(req,res)=>{if(!db||!config.googleClientId||!config.googleClientSecret)return res.status(503).json({status:'configuration_required'});await db.query('SELECT 1');res.json({status:'ready'});});
 authRoutes(app,{db,config});
 app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false}),sessionMiddleware(db),csrfMiddleware(config));
 connectorRoutes(app,{db,config});
 app.get('/api/v1/me',(req,res)=>res.json({id:req.actor.id,name:req.actor.name,email:req.actor.email,roles:req.actor.roles,csrf:req.actor.csrf,permissions:['command.read','customer.read','customer.write','job.read','job.write','job.approve','job.schedule','job.status','lead.read','lead.write','invoice.read','invoice.write','invoice.approve','resource.read','resource.write','document.read','document.write','integration.read','integration.manage','audit.read','member.manage'].filter(p=>allowed(req.actor.roles,p))}));
 app.post('/api/v1/logout',async(req,res)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[req.sessionHash]);res.clearCookie('__Host-pb_session',{secure:true,httpOnly:true,sameSite:'lax',path:'/'});res.json({ok:true});});
 const read=(path,permission,fn)=>app.get('/api/v1'+path,async(req,res)=>{requirePermission(req.actor,permission);res.json(await tenantTx(db,req.actor,tx=>fn(tx,req)));});
 const write=(path,permission,schema,fn,method='post')=>app[method]('/api/v1'+path,async(req,res)=>{
  requirePermission(req.actor,permission);const input=parse(schema,req.body);const key=req.headers['idempotency-key'];if(typeof key!=='string'||key.length<16||key.length>100)fail(400,'A valid idempotency key is required.');
  const requestHash=hash(JSON.stringify({method:req.method,path:req.path,input}));
  const result=await tenantTx(db,req.actor,async tx=>{
    await tx.query('INSERT INTO idempotency(tenant_id,member_id,key,hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[req.actor.tenant_id,req.actor.id,key,requestHash]);
    const {rows:[record]}=await tx.query('SELECT * FROM idempotency WHERE tenant_id=$1 AND member_id=$2 AND key=$3 FOR UPDATE',[req.actor.tenant_id,req.actor.id,key]);
    if(record.hash!==requestHash)fail(409,'This request key was already used with different data.');if(record.response)return record.response;
    const output=await fn(tx,req,input);await tx.query('UPDATE idempotency SET response=$1 WHERE tenant_id=$2 AND member_id=$3 AND key=$4',[JSON.stringify(output),req.actor.tenant_id,req.actor.id,key]);return output;
  });res.json(result);
 });
 read('/customers','customer.read',async(tx,req)=>{
  const actor=req.actor;
  const fields=actor.roles.includes('bookkeeper')&&!actor.roles.some(r=>['owner','ops'].includes(r))?'c.id,c.name,c.email,c.address,c.source,c.version':'c.*';
  const filter=restricted(actor)?' AND EXISTS(SELECT 1 FROM jobs j JOIN assignments a ON a.tenant_id=j.tenant_id AND a.job_id=j.id WHERE j.tenant_id=c.tenant_id AND j.customer_id=c.id AND a.member_id=$2)':'';
  return (await tx.query(`SELECT ${fields} FROM customers c WHERE c.tenant_id=$1${filter} ORDER BY c.created_at DESC LIMIT 200`,params(actor))).rows;
 });
 app.get('/api/v1/summary',async(req,res)=>res.json(await tenantTx(db,req.actor,async tx=>{
  const actor=req.actor;
  const jobs=allowed(actor.roles,'job.read')?(await tx.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='draft' AND source='app')::int AS awaiting_approval,count(*) FILTER(WHERE starts_at AT TIME ZONE 'America/Chicago' >= date_trunc('day',now() AT TIME ZONE 'America/Chicago') AND starts_at AT TIME ZONE 'America/Chicago' < date_trunc('day',now() AT TIME ZONE 'America/Chicago')+interval '1 day' AND status<>'canceled')::int AS today FROM jobs j WHERE tenant_id=$1${bound(actor)}`,params(actor))).rows[0]:null;
  const leads=allowed(actor.roles,'lead.read')?(await tx.query(`SELECT count(*) FILTER(WHERE stage NOT IN('won','lost'))::int AS open FROM leads WHERE tenant_id=$1${restricted(actor)?' AND owner_id=$2':''}`,params(actor))).rows[0]:null;
  const invoices=allowed(actor.roles,'invoice.read')?(await tx.query("SELECT count(*) FILTER(WHERE status='draft')::int AS drafts FROM invoices WHERE tenant_id=$1",[actor.tenant_id])).rows[0]:null;
  return {jobs,leads,invoices,mode:config.operationalMode,as_of:new Date().toISOString()};
 })));
 app.get('/api/v1/command-center',async(req,res)=>{requirePermission(req.actor,'command.read');res.json(await readOperatingCommandCenter(config,{roles:req.actor.roles}));});
 write('/customers','customer.write',contactSchema,async(tx,req,input)=>{
  const {email,phone}=normalizeContact(input);
  // Serialize matching checks per tenant, including concurrent imports.
  await tx.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[req.actor.tenant_id]);
  const matches=await tx.query('SELECT id FROM customers WHERE tenant_id=$1 AND (($2::text IS NOT NULL AND email=$2) OR ($3::text IS NOT NULL AND phone=$3))',[req.actor.tenant_id,email,phone]);
  if(matches.rowCount)fail(409,'A contact has this email or phone. Review the existing record before creating another.');
  const {rows:[row]}=await tx.query('INSERT INTO customers(tenant_id,name,email,phone,address) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.actor.tenant_id,input.name,email,phone,input.address||null]);await audit(tx,req.actor,'customer.created',row.id);return row;
 });
 read('/jobs','job.read',async(tx,req)=>{
  const rows=(await tx.query(`SELECT j.*,c.name AS customer_name FROM jobs j JOIN customers c ON c.tenant_id=j.tenant_id AND c.id=j.customer_id WHERE j.tenant_id=$1${bound(req.actor)} ORDER BY j.starts_at NULLS LAST,j.created_at DESC LIMIT 200`,params(req.actor))).rows;
  if(restricted(req.actor))return rows.map(({id,title,status,starts_at,ends_at,customer_name,source,version})=>({id,title,status,starts_at,ends_at,customer_name,source,version}));return rows;
 });
 write('/jobs','job.write',z.object({customer_id:uuid,title:text}).strict(),async(tx,req,input)=>{
  const {rows:[row]}=await tx.query('INSERT INTO jobs(tenant_id,customer_id,title) VALUES($1,$2,$3) RETURNING *',[req.actor.tenant_id,input.customer_id,input.title]);await audit(tx,req.actor,'job.drafted',row.id);return row;
 });
 write('/jobs/:id/approve','job.approve',z.object({version:z.number().int().positive(),agreement_at:z.iso.datetime(),deposit_required_minor:z.number().int().nonnegative().max(1e12),deposit_paid_minor:z.number().int().nonnegative().max(1e12)}).strict(),async(tx,req,input)=>{
  const {rows:[row]}=await tx.query("UPDATE jobs SET approved_at=now(),agreement_at=$1,deposit_required_minor=$2,deposit_paid_minor=$3,status='ready',version=version+1 WHERE tenant_id=$4 AND id=$5 AND version=$6 AND source='app' AND status IN('draft','ready') RETURNING *",[input.agreement_at,input.deposit_required_minor,input.deposit_paid_minor,req.actor.tenant_id,id(req),input.version]);if(!row)fail(409,'Refresh the job. Only a current app draft may be approved.');await audit(tx,req.actor,'job.approval.recorded',row.id,{evidence:'owner_attestation'});return row;
 });
 write('/jobs/:id/schedule','job.schedule',z.object({version:z.number().int().positive(),starts_at:z.iso.datetime(),ends_at:z.iso.datetime(),resource_ids:z.array(uuid).min(1).max(20)}).strict(),async(tx,req,input)=>{
  const {rows:[job]}=await tx.query('SELECT * FROM jobs WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[req.actor.tenant_id,id(req)]);if(!job)fail(404,'Job unavailable.');if(job.version!==input.version)fail(409,'Job changed. Refresh and try again.');
  if(job.source!=='app')fail(409,'Schedule this HCP job in Housecall Pro until its command integration is approved.');
  if(config.operationalMode!=='custom')fail(409,'Custom scheduling is locked until the owner approves the HCP cutover.');
  if(['complete','canceled'].includes(job.status))fail(409,'Closed jobs cannot be scheduled.');scheduleGate(job);
  const start=new Date(input.starts_at),end=new Date(input.ends_at);if(end<=start||end-start>7*86400000)fail(422,'Choose a positive booking interval of at most seven days.');
  const resourceIds=[...new Set(input.resource_ids)].sort();
  const resources=await tx.query('SELECT id FROM resources WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND active ORDER BY id FOR UPDATE',[req.actor.tenant_id,resourceIds]);if(resources.rowCount!==resourceIds.length)fail(422,'A selected resource is unavailable.');
  await tx.query("UPDATE reservations SET status='released' WHERE tenant_id=$1 AND job_id=$2",[req.actor.tenant_id,job.id]);
  for(const resourceId of resourceIds)await tx.query("INSERT INTO reservations(tenant_id,job_id,resource_id,during) VALUES($1,$2,$3,tstzrange($4,$5,'[)'))",[req.actor.tenant_id,job.id,resourceId,input.starts_at,input.ends_at]);
  const {rows:[row]}=await tx.query("UPDATE jobs SET starts_at=$1,ends_at=$2,status='scheduled',version=version+1 WHERE tenant_id=$3 AND id=$4 RETURNING *",[input.starts_at,input.ends_at,req.actor.tenant_id,job.id]);await audit(tx,req.actor,'job.scheduled',job.id);return row;
 });
 read('/resources','resource.read',async(tx,req)=>(await tx.query('SELECT * FROM resources WHERE tenant_id=$1 AND active ORDER BY name',[req.actor.tenant_id])).rows);
 read('/assignable-members','job.write',async(tx,req)=>(await tx.query("SELECT id,name,roles FROM members WHERE tenant_id=$1 AND status='active' ORDER BY name",[req.actor.tenant_id])).rows);
 read('/jobs/:id/assignments','job.write',async(tx,req)=>(await tx.query('SELECT member_id FROM assignments WHERE tenant_id=$1 AND job_id=$2',[req.actor.tenant_id,id(req)])).rows);
 write('/jobs/:id/assignments','job.write',z.object({version:z.number().int().positive(),member_ids:z.array(uuid).max(50)}).strict(),async(tx,req,input)=>{
  const {rows:[job]}=await tx.query('SELECT version FROM jobs WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[req.actor.tenant_id,id(req)]);if(!job)fail(404,'Job unavailable.');if(job.version!==input.version)fail(409,'Refresh the job before changing access.');
  const members=[...new Set(input.member_ids)];const available=await tx.query("SELECT id FROM members WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND status='active'",[req.actor.tenant_id,members]);if(available.rowCount!==members.length)fail(422,'Choose active members of this company.');
  await tx.query('DELETE FROM assignments WHERE tenant_id=$1 AND job_id=$2',[req.actor.tenant_id,id(req)]);for(const memberId of members)await tx.query('INSERT INTO assignments(tenant_id,job_id,member_id) VALUES($1,$2,$3)',[req.actor.tenant_id,id(req),memberId]);
  const {rows:[row]}=await tx.query('UPDATE jobs SET version=version+1 WHERE tenant_id=$1 AND id=$2 RETURNING id,version',[req.actor.tenant_id,id(req)]);await audit(tx,req.actor,'job.assignments.updated',row.id,{member_ids:members});return row;
 },'put');
 write('/jobs/:id/status','job.status',z.object({version:z.number().int().positive(),status:z.enum(['in_progress','complete','canceled'])}).strict(),async(tx,req,input)=>{
  const {rows:[job]}=await tx.query('SELECT * FROM jobs WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[req.actor.tenant_id,id(req)]);
  if(!job)fail(404,'Job unavailable.');
  if(restricted(req.actor)){const assigned=await tx.query('SELECT 1 FROM assignments WHERE tenant_id=$1 AND job_id=$2 AND member_id=$3',[req.actor.tenant_id,job.id,req.actor.id]);if(!assigned.rowCount)fail(404,'Assigned job unavailable.');if(input.status==='canceled')fail(403,'Only operations may cancel a job.');}
  if(job.source!=='app'||config.operationalMode!=='custom')fail(409,'Manage production status in Housecall Pro until the approved cutover.');
  if(job.version!==input.version)fail(409,'The job changed. Refresh before updating.');
  const valid={in_progress:['scheduled'],complete:['in_progress'],canceled:['draft','ready','scheduled','in_progress']};
  if(!valid[input.status].includes(job.status))fail(409,'This job cannot move to that stage.');
  if(['complete','canceled'].includes(input.status))await tx.query("UPDATE reservations SET status='released' WHERE tenant_id=$1 AND job_id=$2 AND status='confirmed'",[req.actor.tenant_id,job.id]);
  const {rows:[row]}=await tx.query('UPDATE jobs SET status=$1,version=version+1 WHERE tenant_id=$2 AND id=$3 RETURNING id,status,version',[input.status,req.actor.tenant_id,job.id]);await audit(tx,req.actor,'job.'+input.status,job.id);return row;
 });
 write('/resources','resource.write',z.object({name:text,kind:z.enum(['person','equipment'])}).strict(),async(tx,req,input)=>{const {rows:[row]}=await tx.query('INSERT INTO resources(tenant_id,name,kind) VALUES($1,$2,$3) RETURNING *',[req.actor.tenant_id,input.name,input.kind]);await audit(tx,req.actor,'resource.created',row.id);return row;});
 read('/leads','lead.read',async(tx,req)=>{
  const actor=req.actor;const filter=restricted(actor)?' AND l.owner_id=$2':'';
  return (await tx.query(`SELECT l.*,c.name AS customer_name FROM leads l JOIN customers c ON c.tenant_id=l.tenant_id AND c.id=l.customer_id WHERE l.tenant_id=$1${filter} ORDER BY l.next_action_at NULLS LAST LIMIT 200`,params(actor))).rows;
 });
 write('/leads','lead.write',z.object({customer_id:uuid,source:optionalText,next_action:text,next_action_at:z.iso.datetime()}).strict(),async(tx,req,input)=>{
  if(restricted(req.actor))fail(403,'Only operations can create a new lead.');const {rows:[row]}=await tx.query('INSERT INTO leads(tenant_id,customer_id,source,next_action,next_action_at,owner_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[req.actor.tenant_id,input.customer_id,input.source||null,input.next_action,input.next_action_at,req.actor.id]);await audit(tx,req.actor,'lead.created',row.id);return row;
 });
 write('/leads/:id','lead.write',z.object({version:z.number().int().positive(),stage:z.enum(['new','qualified','estimate','follow_up','won','lost']),next_action:text,next_action_at:z.iso.datetime()}).strict(),async(tx,req,input)=>{
  const {rows:[row]}=await tx.query('UPDATE leads SET stage=$1,next_action=$2,next_action_at=$3,version=version+1 WHERE tenant_id=$4 AND id=$5 AND version=$6 AND ($7::boolean=false OR owner_id=$8) RETURNING *',[input.stage,input.next_action,input.next_action_at,req.actor.tenant_id,id(req),input.version,restricted(req.actor),req.actor.id]);if(!row)fail(409,'This lead changed or is not assigned to you.');await audit(tx,req.actor,'lead.updated',row.id);return row;
 },'patch');
 read('/invoices','invoice.read',async(tx,req)=>(await tx.query('SELECT i.*,j.title AS job_title,c.name AS customer_name FROM invoices i JOIN jobs j ON j.tenant_id=i.tenant_id AND j.id=i.job_id JOIN customers c ON c.tenant_id=j.tenant_id AND c.id=j.customer_id WHERE i.tenant_id=$1 ORDER BY i.created_at DESC LIMIT 200',[req.actor.tenant_id])).rows);
 write('/invoices','invoice.write',z.object({job_id:uuid,number:text,due_date:z.iso.date(),lines:z.array(z.object({description:text,quantity:z.number().int().positive(),unit_minor:z.number().int().nonnegative(),tax_minor:z.number().int().nonnegative()}).strict()).min(1).max(100)}).strict(),async(tx,req,input)=>{
  const total=calculateInvoice(input.lines);const {rows:[row]}=await tx.query('INSERT INTO invoices(tenant_id,job_id,number,due_date,lines,total_minor) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[req.actor.tenant_id,input.job_id,input.number,input.due_date,JSON.stringify(input.lines),total]);await audit(tx,req.actor,'invoice.drafted',row.id);return row;
 });
 write('/invoices/:id/approve','invoice.approve',z.object({version:z.number().int().positive()}).strict(),async(tx,req,input)=>{
  const {rows:[row]}=await tx.query("UPDATE invoices SET status='approved',approved_by=$1,approved_at=now(),version=version+1 WHERE tenant_id=$2 AND id=$3 AND version=$4 AND status='draft' AND source='app' RETURNING *",[req.actor.id,req.actor.tenant_id,id(req),input.version]);if(!row)fail(409,'Refresh the invoice. Only current drafts can be approved.');await audit(tx,req.actor,'invoice.approved',row.id);return row;
 });
 write('/invoices/:id','invoice.write',z.object({version:z.number().int().positive(),due_date:z.iso.date(),lines:z.array(z.object({description:text,quantity:z.number().int().positive(),unit_minor:z.number().int().nonnegative(),tax_minor:z.number().int().nonnegative()}).strict()).min(1).max(100)}).strict(),async(tx,req,input)=>{
  const total=calculateInvoice(input.lines);const {rows:[row]}=await tx.query("UPDATE invoices SET due_date=$1,lines=$2,total_minor=$3,version=version+1 WHERE tenant_id=$4 AND id=$5 AND version=$6 AND status='draft' AND source='app' RETURNING *",[input.due_date,JSON.stringify(input.lines),total,req.actor.tenant_id,id(req),input.version]);if(!row)fail(409,'Only a current, unapproved app draft can be edited.');await audit(tx,req.actor,'invoice.draft.edited',row.id);return row;
 },'patch');
 write('/imports','customer.write',z.object({rows:z.array(contactSchema).min(1).max(500)}).strict(),async(tx,req,input)=>{
  const staged=[];for(const raw of input.rows){try{const normalized=normalizeContact(raw);const {rows:matches}=await tx.query('SELECT id,name FROM customers WHERE tenant_id=$1 AND (($2::text IS NOT NULL AND email=$2) OR ($3::text IS NOT NULL AND phone=$3))',[req.actor.tenant_id,normalized.email,normalized.phone]);staged.push({...raw,...normalized,matches,status:matches.length?'review':'new'});}catch(e){staged.push({...raw,status:'invalid',error:e.message});}}
  const {rows:[row]}=await tx.query('INSERT INTO import_batches(tenant_id,rows,created_by) VALUES($1,$2,$3) RETURNING *',[req.actor.tenant_id,JSON.stringify(staged),req.actor.id]);await audit(tx,req.actor,'import.staged',row.id,{count:staged.length});return row;
 });
 write('/imports/:id/commit','customer.write',z.object({}).strict(),async(tx,req)=>{
  const {rows:[batch]}=await tx.query('SELECT * FROM import_batches WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[req.actor.tenant_id,id(req)]);if(!batch)fail(404,'Import unavailable.');if(batch.status==='committed')return {created:0,status:'already_committed'};
  await tx.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[req.actor.tenant_id]);let created=0,skipped=0;
  for(const row of batch.rows){if(row.status!=='new'){skipped++;continue;}const match=await tx.query('SELECT id FROM customers WHERE tenant_id=$1 AND (($2::text IS NOT NULL AND email=$2) OR ($3::text IS NOT NULL AND phone=$3))',[req.actor.tenant_id,row.email,row.phone]);if(match.rowCount){skipped++;continue;}await tx.query('INSERT INTO customers(tenant_id,name,email,phone,address) VALUES($1,$2,$3,$4,$5)',[req.actor.tenant_id,row.name,row.email,row.phone,row.address||null]);created++;}
  await tx.query("UPDATE import_batches SET status='committed' WHERE tenant_id=$1 AND id=$2",[req.actor.tenant_id,batch.id]);await audit(tx,req.actor,'import.committed',batch.id,{created,skipped});return {created,skipped,status:'committed'};
 });
 read('/integrations','integration.read',async(tx,req)=>{
  const stored=(await tx.query('SELECT provider,account_id,status,last_success_at,detail FROM connections WHERE tenant_id=$1',[req.actor.tenant_id])).rows;
  return {mode:config.operationalMode,providers:['housecall','quickbooks','gmail','calendar','drive','notion'].map(provider=>{const connection=stored.find(c=>c.provider===provider)||{provider,status:'not_connected',last_success_at:null};if(connection.status==='connected'&&(!connection.last_success_at||Date.now()-new Date(connection.last_success_at).getTime()>15*60000))connection.status='stale';return connection;}),notionUrl:'https://app.notion.com/p/3d8401438e5081e18352cf276fd2b344'};
 });
 read('/audit','audit.read',async(tx,req)=>(await tx.query('SELECT action,entity_id,created_at FROM audit_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100',[req.actor.tenant_id])).rows);
 read('/accounting','invoice.read',async(tx,req)=>(await tx.query("SELECT external_id,data,observed_at FROM external_snapshots WHERE tenant_id=$1 AND provider='quickbooks' AND entity_type='invoice' ORDER BY observed_at DESC LIMIT 200",[req.actor.tenant_id])).rows);
 read('/members','member.manage',async(tx,req)=>(await tx.query('SELECT id,name,email,roles,status,permission_version FROM members WHERE tenant_id=$1 ORDER BY name',[req.actor.tenant_id])).rows);
 write('/members/:id/suspend','member.manage',z.object({}).strict(),async(tx,req)=>{
  const memberId=id(req);if(memberId===req.actor.id)fail(422,'You cannot suspend your own owner account.');const result=await tx.query("UPDATE members SET status='suspended',permission_version=permission_version+1 WHERE tenant_id=$1 AND id=$2 RETURNING id",[req.actor.tenant_id,memberId]);if(!result.rowCount)fail(404,'Member unavailable.');await tx.query('DELETE FROM sessions WHERE member_id=$1',[memberId]);await audit(tx,req.actor,'member.suspended',memberId);return {ok:true};
 });
 read('/documents','document.read',async(tx,req)=>{
  const financial=allowed(req.actor.roles,'invoice.read');const rows=(await tx.query(`SELECT d.id,d.job_id,d.name,d.mime,d.size_bytes,d.status,d.classification,d.created_at,j.title AS job_title FROM documents d JOIN jobs j ON j.tenant_id=d.tenant_id AND j.id=d.job_id WHERE d.tenant_id=$1${bound(req.actor)} ORDER BY d.created_at DESC LIMIT 200`,params(req.actor))).rows;return rows.filter(d=>financial||d.classification!=='financial');
 });
 // Only ready, scanned documents may be streamed. No shareable download URL.
 write('/documents','document.write',z.object({job_id:uuid,name:text,mime:z.enum(['application/pdf','image/jpeg','image/png','image/webp']),size_bytes:z.number().int().positive().max(20*1024*1024),classification:z.enum(['job','financial'])}).strict(),async(tx,req,input)=>{
  if(!config.bucket)fail(503,'Private storage is not configured.');if(input.classification==='financial')requirePermission(req.actor,'invoice.read');
  if(restricted(req.actor)){const assigned=await tx.query('SELECT 1 FROM assignments WHERE tenant_id=$1 AND job_id=$2 AND member_id=$3',[req.actor.tenant_id,input.job_id,req.actor.id]);if(!assigned.rowCount)fail(404,'Assigned job unavailable.');}
  const documentId=randomUUID();const {rows:[row]}=await tx.query('INSERT INTO documents(tenant_id,id,job_id,name,mime,size_bytes,classification,object_key,uploader_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,status',[req.actor.tenant_id,documentId,input.job_id,input.name,input.mime,input.size_bytes,input.classification,req.actor.tenant_id+'/'+documentId,req.actor.id]);await audit(tx,req.actor,'document.upload.started',documentId);return row;
 });
 app.put('/api/v1/documents/:id/upload',express.raw({type:'application/octet-stream',limit:'20mb'}),async(req,res)=>{
  requirePermission(req.actor,'document.write');if(!config.bucket)fail(503,'Private storage is not configured.');if(!Buffer.isBuffer(req.body))fail(422,'Upload binary file content.');
  await tenantTx(db,req.actor,async tx=>{const {rows:[doc]}=await tx.query('SELECT * FROM documents WHERE tenant_id=$1 AND id=$2 AND uploader_id=$3 FOR UPDATE',[req.actor.tenant_id,id(req),req.actor.id]);if(!doc)fail(404,'Upload unavailable.');if(doc.status!=='quarantine'||doc.sha256)fail(409,'This upload has already been finalized.');if(req.body.length!==Number(doc.size_bytes))fail(422,'The upload size does not match.');
   if(doc.classification==='financial')requirePermission(req.actor,'invoice.read');
   if(restricted(req.actor)){const assigned=await tx.query('SELECT 1 FROM assignments WHERE tenant_id=$1 AND job_id=$2 AND member_id=$3',[req.actor.tenant_id,doc.job_id,req.actor.id]);if(!assigned.rowCount)fail(404,'Assigned job unavailable.');}
   const prefix=req.body.subarray(0,12);const valid=doc.mime==='application/pdf'?prefix.subarray(0,5).toString()==='%PDF-':doc.mime==='image/png'?prefix.subarray(0,8).toString('hex')==='89504e470d0a1a0a':doc.mime==='image/jpeg'?prefix.subarray(0,3).toString('hex')==='ffd8ff':prefix.subarray(0,4).toString()==='RIFF'&&prefix.subarray(8,12).toString()==='WEBP';if(!valid)fail(422,'File content does not match its declared type.');
   const {Storage}=await import('@google-cloud/storage');await new Storage().bucket(config.bucket).file(doc.object_key).save(req.body,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:doc.mime}});await tx.query('UPDATE documents SET sha256=$1 WHERE tenant_id=$2 AND id=$3',[hash(req.body),req.actor.tenant_id,doc.id]);await audit(tx,req.actor,'document.quarantined',doc.id);
  });res.json({status:'quarantine'});
 });
 app.get('/api/v1/documents/:id/content',async(req,res)=>{
  requirePermission(req.actor,'document.read');const doc=await tenantTx(db,req.actor,async tx=>{const {rows:[row]}=await tx.query('SELECT * FROM documents WHERE tenant_id=$1 AND id=$2',[req.actor.tenant_id,id(req)]);if(!row)fail(404,'Document unavailable.');if(row.classification==='financial')requirePermission(req.actor,'invoice.read');if(restricted(req.actor)){const a=await tx.query('SELECT 1 FROM assignments WHERE tenant_id=$1 AND job_id=$2 AND member_id=$3',[req.actor.tenant_id,row.job_id,req.actor.id]);if(!a.rowCount)fail(404,'Document unavailable.');}if(row.status!=='ready')fail(409,'Document is awaiting a security scan.');await audit(tx,req.actor,'document.downloaded',row.id);return row;});
  if(!config.bucket)fail(503,'Private storage is not configured.');const {Storage}=await import('@google-cloud/storage');const stream=new Storage().bucket(config.bucket).file(doc.object_key).createReadStream();res.type(doc.mime);res.attachment(doc.name);stream.on('error',()=>{if(!res.headersSent)res.status(502).end();else res.destroy();});stream.pipe(res);
 });
 app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{index:'index.html',etag:false,cacheControl:false}));
 app.use((req,res)=>res.status(404).json({error:'Not found.'}));
 app.use((err,req,res,next)=>{
  const status=err.status||({'23503':422,'23505':409,'23P01':409,'22P02':422}[err.code])||500;
  const message=err.status?err.message:err.code==='23P01'?'A resource is already booked for that interval.':status===409?'This record already exists or conflicts with another change.':status===422?'A related record or value is invalid.':'The request could not be completed. Try again or contact the owner.';
  if(status===500)console.error(JSON.stringify({event:'request_failed',requestId:res.get('X-Request-ID'),code:err.code||'internal'}));
  if(req.path.startsWith('/auth/'))return res.status(status).type('text').send(message);res.status(status).json({error:message,requestId:res.get('X-Request-ID')});
 });return app;
}
