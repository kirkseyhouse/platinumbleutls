import pg from 'pg';
export function createDatabase(url){
  if(!url)return null;
  const pool=new pg.Pool({connectionString:url,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
  return {query:(...args)=>pool.query(...args),close:()=>pool.end(),async tx(fn){const client=await pool.connect();try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}};
}
export async function tenantTx(db,actor,fn){
  return db.tx(async tx=>{await tx.query("select set_config('app.tenant_id',$1,true)",[actor.tenant_id]);return fn(tx);});
}
export async function audit(tx,actor,action,entityId=null,detail={}){
  await tx.query('INSERT INTO audit_events(tenant_id,actor_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5)',[actor.tenant_id,actor.id,action,entityId,JSON.stringify(detail)]);
}
