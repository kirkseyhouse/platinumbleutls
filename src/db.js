import pg from 'pg';
import {Connector,IpAddressTypes,AuthTypes} from '@google-cloud/cloud-sql-connector';

const instanceConnectionName='platinum-bleu-drive:us-central1:pb-prod-sql';
const database='platinum_bleu';
const users={runtime:'pb-dashboard-runtime@platinum-bleu-drive.iam',worker:'pb-dashboard-worker@platinum-bleu-drive.iam',migration:'pb-dashboard-migrate@platinum-bleu-drive.iam'};

// Traverse all membership, including NOINHERIT roles that could be reached with
// SET ROLE. Table/schema/database ownership and elevated reachable roles defeat
// the isolation expected of both web requests and background workers.
const reachableRolesSql=`WITH RECURSIVE reachable(oid) AS (
 SELECT oid FROM pg_roles WHERE rolname=current_user
 UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON m.member=r.oid
)
SELECT current_user,session_user,`;
const elevatedRoleSql=`EXISTS(SELECT 1 FROM pg_roles r JOIN reachable a USING(oid)
        WHERE r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)`;
const reachableDatabaseCreateSql=`EXISTS(SELECT 1 FROM reachable a
        WHERE has_database_privilege(a.oid,current_database(),'CREATE'))`;
const roleSafetySql=`${reachableRolesSql}
 ${elevatedRoleSql}
 OR EXISTS(SELECT 1 FROM pg_roles r JOIN reachable a USING(oid) WHERE r.rolname=$1)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN reachable a ON c.relowner=a.oid
           JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
 OR EXISTS(SELECT 1 FROM pg_namespace n JOIN reachable a ON n.nspowner=a.oid WHERE n.nspname='public')
 OR EXISTS(SELECT 1 FROM reachable a WHERE has_schema_privilege(a.oid,'public','CREATE'))
 OR ${reachableDatabaseCreateSql} AS unsafe`;
const migrationSafetySql=`${reachableRolesSql} ${elevatedRoleSql} OR ${reachableDatabaseCreateSql} AS unsafe`;

export async function createDatabase({env,purpose},{Pool=pg.Pool,Connector:ConnectorClass=Connector}={}){
  if(!env||!Object.hasOwn(users,purpose))throw new Error('Explicit database environment and workload purpose are required.');
  const production=env.NODE_ENV==='production';
  if(!production&&((env.NODE_ENV&&!['development','test'].includes(env.NODE_ENV))||env.K_SERVICE||env.CLOUD_RUN_JOB))throw new Error('Deployed workloads require NODE_ENV=production and IAM database configuration.');
  if(production){
    if(['DATABASE_URL','MIGRATION_DATABASE_URL','PGPASSWORD','PGHOST','PGHOSTADDR','PGPORT','PGUSER','PGDATABASE','PGSERVICE','PGSERVICEFILE','PGPASSFILE','PGSSLMODE'].some(key=>env[key]!==undefined))throw new Error('Production database URL, password and PostgreSQL connection overrides are prohibited.');
    if(env.INSTANCE_CONNECTION_NAME!==instanceConnectionName||env.DB_NAME!==database||env.DB_IAM_USER!==users[purpose])throw new Error('Production requires the approved private Cloud SQL instance, database and workload IAM user.');
  }
  const url=purpose==='migration'?(env.MIGRATION_DATABASE_URL||env.DATABASE_URL):env.DATABASE_URL;
  if(!production&&!url)return null;
  let connector,pool,closing;
  const close=()=>closing??=(async()=>{try{await pool?.end();}finally{await connector?.close();}})();
  try{
    let options={connectionString:url};
    if(production){
      connector=new ConnectorClass();
      options={...await connector.getOptions({instanceConnectionName,ipType:IpAddressTypes.PRIVATE,authType:AuthTypes.IAM}),user:users[purpose],database};
    }
    pool=new Pool({...options,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
    pool.on('error',()=>console.error(JSON.stringify({event:'database_idle_connection_error'})));
    if(production){
      const {rows:[role]}=purpose==='migration'
        ?await pool.query(migrationSafetySql)
        :await pool.query(roleSafetySql,[users.migration]);
      if(!role||role.current_user!==users[purpose]||role.session_user!==users[purpose]||role.unsafe!==false)throw new Error('Unsafe database role.');
    }
    return {
      query:(...args)=>pool.query(...args),close,
      async tx(fn){
        const client=await pool.connect();
        let discard;
        try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}
        catch(error){try{await client.query('ROLLBACK');}catch(rollbackError){discard=rollbackError;}throw error;}
        finally{client.release(discard);}
      }
    };
  }catch{
    try{await close();}catch{/* Keep initialization failures free of driver credentials. */}
    throw new Error('Database initialization failed; verify IAM connectivity and database role grants.');
  }
}
export async function tenantTx(db,actor,fn){
  return db.tx(async tx=>{await tx.query("select set_config('app.tenant_id',$1,true)",[actor.tenant_id]);return fn(tx);});
}
export async function audit(tx,actor,action,entityId=null,detail={}){
  await tx.query('INSERT INTO audit_events(tenant_id,actor_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5)',[actor.tenant_id,actor.id,action,entityId,JSON.stringify(detail)]);
}
