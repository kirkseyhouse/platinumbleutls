import {tenantTx} from './db.js';
export async function drainInbox(db,config,refresh,{limit=20}={}){
 const actor={tenant_id:config.tenantId};let handled=0;
 for(let n=0;n<limit;n++){
  const item=await tenantTx(db,actor,async tx=>{
   const {rows:[row]}=await tx.query("SELECT * FROM webhook_inbox WHERE tenant_id=$1 AND status IN('pending','retry','processing') AND next_attempt_at<=now() AND attempts<8 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",[actor.tenant_id]);if(!row)return null;
   await tx.query("UPDATE webhook_inbox SET status='processing',attempts=attempts+1,next_attempt_at=now()+interval '10 minutes' WHERE tenant_id=$1 AND provider=$2 AND event_key=$3",[actor.tenant_id,row.provider,row.event_key]);return {...row,attempts:row.attempts+1};
  });if(!item)break;
  try{await refresh(db,config,item.provider);await tenantTx(db,actor,tx=>tx.query("UPDATE webhook_inbox SET status='done' WHERE tenant_id=$1 AND provider=$2 AND event_key=$3",[actor.tenant_id,item.provider,item.event_key]));handled++;}
  catch(error){const delay=Math.min(3600,2**item.attempts*15+Math.floor(Math.random()*10));await tenantTx(db,actor,tx=>tx.query('UPDATE webhook_inbox SET status=$1,next_attempt_at=$2 WHERE tenant_id=$3 AND provider=$4 AND event_key=$5',[item.attempts>=8?'dead':'retry',new Date(Date.now()+delay*1000),actor.tenant_id,item.provider,item.event_key]));}
 }
 // A worker terminated during its final attempt must eventually surface as dead.
 await tenantTx(db,actor,tx=>tx.query("UPDATE webhook_inbox SET status='dead' WHERE tenant_id=$1 AND status='processing' AND attempts>=8 AND next_attempt_at<=now()",[actor.tenant_id]));return {handled};
}
