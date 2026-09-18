import {accessToken} from './connectors.js';
import {tenantTx} from './db.js';
import {fail} from './domain.js';
export async function providerJSON(url,token,options={}){
 const result=await fetch(url,{...options,redirect:'error',headers:{authorization:(new URL(url).hostname==='api.housecallpro.com'?'Token ':'Bearer ')+token,accept:'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
 if(!result.ok){const e=new Error('Provider request failed');e.status=result.status;e.retryAfter=result.headers.get('retry-after');throw e;}return result.status===204?{}:result.json();
}
async function saveSnapshot(tx,tenant,provider,type,id,data){await tx.query('INSERT INTO external_snapshots(tenant_id,provider,entity_type,external_id,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,provider,entity_type,external_id) DO UPDATE SET data=excluded.data,observed_at=now()',[tenant,provider,type,String(id),JSON.stringify(data)]);}
export async function synchronize(db,config,provider){
 const actor={tenant_id:config.tenantId};if(!actor.tenant_id)fail(503,'Configure the approved tenant.');
 let processed=0;const refreshStarted=new Date();
 // Refresh is committed before any downstream provider call, preserving rotated tokens.
 const token=provider==='housecall'?config.hcpKey:provider==='notion'?config.notionToken:await tenantTx(db,actor,tx=>accessToken(tx,actor.tenant_id,provider,config));
 if(!token)fail(503,'Provider credentials are unavailable.');
 const record=async(type,id,data)=>tenantTx(db,actor,async tx=>{await saveSnapshot(tx,actor.tenant_id,provider,type,id,data);processed++;});
 if(provider==='quickbooks'){
  if(!config.qboRealmId)fail(503,'QuickBooks realm is required.');const base=config.qboEnvironment==='production'?'https://quickbooks.api.intuit.com':'https://sandbox-quickbooks.api.intuit.com';
  for(let start=1;start<=100000;start+=1000){const query=`SELECT * FROM Invoice STARTPOSITION ${start} MAXRESULTS 1000`;const result=await providerJSON(base+'/v3/company/'+encodeURIComponent(config.qboRealmId)+'/query?query='+encodeURIComponent(query),token);const rows=result.QueryResponse?.Invoice||[];for(const row of rows)await record('invoice',row.Id,{Id:row.Id,SyncToken:row.SyncToken,DocNumber:row.DocNumber,TotalAmt:row.TotalAmt,Balance:row.Balance,DueDate:row.DueDate,CurrencyRef:row.CurrencyRef,CustomerRef:row.CustomerRef?.value,MetaData:row.MetaData});if(rows.length<1000)break;if(start===99001)fail(503,'QBO import exceeds the configured safety limit.');}
 }else if(provider==='gmail'){
  // Deliberately bounded metadata window. No email body or attachment retrieval.
  const result=await providerJSON('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&labelIds=INBOX',token);
  for(const row of result.messages||[]){const message=await providerJSON('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(row.id)+'?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject',token);await record('message',row.id,{id:message.id,threadId:message.threadId,internalDate:message.internalDate,headers:message.payload?.headers||[]});}
 }else if(provider==='calendar'){
  if(!config.calendarId)fail(503,'Configure the approved business calendar ID.');let pageToken;
  do{const query=new URLSearchParams({maxResults:'250',singleEvents:'true',timeMin:new Date(Date.now()-30*86400000).toISOString(),timeMax:new Date(Date.now()+180*86400000).toISOString()});if(pageToken)query.set('pageToken',pageToken);const result=await providerJSON('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(config.calendarId)+'/events?'+query,token);for(const row of result.items||[])await record('event',row.id,{id:row.id,etag:row.etag,status:row.status,summary:row.summary,start:row.start,end:row.end,updated:row.updated});pageToken=result.nextPageToken;}while(pageToken);
 }else if(provider==='drive'){
  if(!config.driveFolderId||!/^[a-zA-Z0-9_-]+$/.test(config.driveFolderId))fail(503,'Configure the approved Drive folder.');let pageToken;
  do{const query=new URLSearchParams({q:`'${config.driveFolderId}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(pageToken)query.set('pageToken',pageToken);const result=await providerJSON('https://www.googleapis.com/drive/v3/files?'+query,token);for(const row of result.files||[])await record('file',row.id,row);pageToken=result.nextPageToken;}while(pageToken);
 }else if(provider==='notion'){
  if(!config.notionRoot)fail(503,'Configure the approved existing Notion root.');const result=await providerJSON('https://api.notion.com/v1/pages/'+encodeURIComponent(config.notionRoot),token,{headers:{'Notion-Version':'2022-06-28'}});await record('page',result.id,{id:result.id,url:result.url,last_edited_time:result.last_edited_time});
 }else if(provider==='housecall'){
  // API shape must be verified against the connected company's entitlement before activation.
  const company=await providerJSON('https://api.housecallpro.com/company',token);
  if((company.id||company.company?.id)!==config.hcpCompanyId)fail(403,'Housecall Pro company does not match the approved connection.');
  const staged=[];let stagedBytes=0;
  for(const entity of ['customers','jobs']){
   const ids=new Set();let totalPages,totalItems;
   for(let page=1;page<=1000;page++){const result=await providerJSON(`https://api.housecallpro.com/${entity}?page=${page}&page_size=100&sort_by=id&sort_direction=asc`,token);const rows=result[entity];if(!Array.isArray(rows)||result.page!==page||!Number.isInteger(result.total_pages)||!Number.isInteger(result.total_items))fail(502,'HCP payload and pagination require verification.');if(page===1){totalPages=result.total_pages;totalItems=result.total_items;}if(totalPages!==result.total_pages||totalItems!==result.total_items||totalPages>100||totalItems>10000||totalPages<0||totalItems<0)fail(502,'HCP pagination changed during refresh.');for(const row of rows){if(!row.id||ids.has(row.id)||(row.company_id&&row.company_id!==config.hcpCompanyId))fail(502,'Unexpected HCP record identity.');ids.add(row.id);stagedBytes+=Buffer.byteLength(JSON.stringify(row));if(stagedBytes>32*1024*1024)fail(503,'HCP snapshot exceeds the staging memory limit.');staged.push({entity,row});}if(page>=totalPages){if(ids.size!==totalItems)fail(502,'HCP retrieval was incomplete.');break;}if(!rows.length||page===1000)fail(503,'HCP pagination is incomplete or exceeds the safety limit.');}
  }
  // Publish only after both collections validate. Any mapping failure rolls everything back.
  await tenantTx(db,actor,async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.tenant_id+':housecall-refresh']);
   const {rows:[previous]}=await tx.query("SELECT last_success_at FROM connections WHERE tenant_id=$1 AND provider='housecall'",[actor.tenant_id]);
   if(previous?.last_success_at&&new Date(previous.last_success_at)>refreshStarted)fail(409,'A newer HCP refresh was already published.');
   for(const {entity,row} of staged){await saveSnapshot(tx,actor.tenant_id,provider,entity,row.id,row);await projectHcp(tx,config,entity,row);processed++;}
   await tx.query("INSERT INTO connections(tenant_id,provider,status,last_success_at,detail) VALUES($1,'housecall','connected',now(),$2) ON CONFLICT(tenant_id,provider) DO UPDATE SET status='connected',last_success_at=now(),detail=excluded.detail",[actor.tenant_id,`Validated read-only refresh: ${processed} records. Deleted source records are not reconciled.`]);
  });
  return {processed};
 }else fail(404,'Provider unavailable.');
 await tenantTx(db,actor,tx=>tx.query("INSERT INTO connections(tenant_id,provider,status,last_success_at,detail) VALUES($1,$2,'connected',now(),$3) ON CONFLICT(tenant_id,provider) DO UPDATE SET status='connected',last_success_at=now(),detail=excluded.detail",[actor.tenant_id,provider,`Read-only snapshot refresh: ${processed} records. Source window and completeness vary by connector.`]));
 return {processed};
}
async function projectHcp(tx,config,entity,row){
  const customer=entity==='customers'?row:row.customer;if(!customer?.id)fail(502,'HCP customer mapping requires verification.');
  const name=[customer.first_name,customer.last_name].filter(Boolean).join(' ')||customer.company||customer.name||'Unnamed HCP customer';
  const {rows:[local]}=await tx.query("INSERT INTO customers(tenant_id,name,email,phone,source,external_id) VALUES($1,$2,$3,$4,'housecall',$5) ON CONFLICT(tenant_id,source,external_id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,version=customers.version+1 RETURNING id",[config.tenantId,name,customer.email||null,customer.mobile_number||customer.home_number||null,String(customer.id)]);
  if(entity==='jobs'){const status=String(row.work_status||row.status||'draft').toLowerCase();const mapped=/cancel/.test(status)?'canceled':/complete/.test(status)?'complete':/progress/.test(status)?'in_progress':row.schedule?.scheduled_start?'scheduled':'draft';await tx.query("INSERT INTO jobs(tenant_id,customer_id,title,status,starts_at,ends_at,source,external_id) VALUES($1,$2,$3,$4,$5,$6,'housecall',$7) ON CONFLICT(tenant_id,source,external_id) DO UPDATE SET customer_id=excluded.customer_id,title=excluded.title,status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at,version=jobs.version+1",[config.tenantId,local.id,row.name||row.description?.slice(0,250)||'HCP job '+(row.invoice_number||row.id),mapped,row.schedule?.scheduled_start||null,row.schedule?.scheduled_end||null,String(row.id)]);}
}
