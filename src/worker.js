import {createDatabase,tenantTx} from './db.js';
import {configuration} from './config.js';
import {synchronize} from './sync.js';
import {drainInbox} from './inbox.js';
const config=configuration(),db=createDatabase(process.env.DATABASE_URL);
if(!db||!config.tenantId)throw new Error('Worker needs PostgreSQL and the approved tenant.');
try{
 await drainInbox(db,config,synchronize);
 const configured=(process.env.SYNC_PROVIDERS||'').split(',').filter(Boolean);
 for(const provider of configured){try{const result=await synchronize(db,config,provider);console.log(JSON.stringify({event:'sync_succeeded',provider,count:result.processed}));}catch(error){await tenantTx(db,{tenant_id:config.tenantId},tx=>tx.query("INSERT INTO connections(tenant_id,provider,status,detail) VALUES($1,$2,'error',$3) ON CONFLICT(tenant_id,provider) DO UPDATE SET status='error',detail=excluded.detail",[config.tenantId,provider,'Refresh failed; reconnect or review provider access.']));console.error(JSON.stringify({event:'sync_failed',provider,status:error.status||500}));process.exitCode=1;}}
 await db.query("DELETE FROM login_transactions WHERE expires_at<now(); DELETE FROM connector_oauth WHERE expires_at<now(); DELETE FROM sessions WHERE expires_at<now() OR seen_at<now()-interval '30 minutes'");
}finally{await db.close();}
