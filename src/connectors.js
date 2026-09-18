import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {hash,secret,sessionMiddleware} from './auth.js';
import {tenantTx,audit} from './db.js';
import {fail,requirePermission} from './domain.js';
const definitions={
 quickbooks:{authorize:'https://appcenter.intuit.com/connect/oauth2',token:'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',scope:'com.intuit.quickbooks.accounting'},
 gmail:{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email https://www.googleapis.com/auth/gmail.metadata'},
 calendar:{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email https://www.googleapis.com/auth/calendar.events'},
 drive:{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email https://www.googleapis.com/auth/drive.file'},
};
export function seal(value,key){const bytes=Buffer.from(key||'','base64');if(bytes.length!==32)fail(503,'Token vault configuration is required.');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',bytes,iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.');}
export function unseal(value,key){const [iv,tag,encrypted]=value.split('.').map(s=>Buffer.from(s,'base64url'));const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(encrypted),cipher.final()]).toString());}
const clientFor=(provider,config)=>provider==='quickbooks'?{id:config.qboClientId,secret:config.qboClientSecret}:{id:config.googleClientId,secret:config.googleClientSecret};
async function tokenRequest(provider,config,values){const client=clientFor(provider,config);const headers={'content-type':'application/x-www-form-urlencoded',accept:'application/json'};if(provider==='quickbooks')headers.authorization='Basic '+Buffer.from(client.id+':'+client.secret).toString('base64');else{values.client_id=client.id;values.client_secret=client.secret;}const result=await fetch(definitions[provider].token,{method:'POST',headers,body:new URLSearchParams(values),signal:AbortSignal.timeout(15000)});if(!result.ok)fail(502,'Provider authorization failed. Reconnect the account.');return result.json();}
export async function accessToken(tx,tenant,provider,config){
 const {rows:[row]}=await tx.query('SELECT * FROM connector_tokens WHERE tenant_id=$1 AND provider=$2 FOR UPDATE',[tenant,provider]);if(!row)fail(503,'Provider is not connected.');const tokens=unseal(row.encrypted,config.tokenKey);
 if(row.expires_at&&new Date(row.expires_at).getTime()>Date.now()+120000)return tokens.access_token;
 if(!tokens.refresh_token)fail(503,'Provider consent must be renewed.');const refreshed=await tokenRequest(provider,config,{grant_type:'refresh_token',refresh_token:tokens.refresh_token});const updated={...tokens,...refreshed,refresh_token:refreshed.refresh_token||tokens.refresh_token};await tx.query('UPDATE connector_tokens SET encrypted=$1,expires_at=$2 WHERE tenant_id=$3 AND provider=$4',[seal(updated,config.tokenKey),new Date(Date.now()+refreshed.expires_in*1000),tenant,provider]);return updated.access_token;
}
export function connectorRoutes(app,{db,config}){
 app.post('/api/v1/integrations/:provider/connect',async(req,res)=>{
  requirePermission(req.actor,'integration.manage');const provider=req.params.provider,definition=definitions[provider];if(!definition)fail(404,'Provider unavailable.');const client=clientFor(provider,config);if(!client.id||!client.secret||!config.tokenKey)fail(503,'The owner must configure this provider and the encrypted token vault first.');
  if(provider==='quickbooks'&&!config.qboRealmId)fail(503,'Configure the approved QuickBooks company ID first.');
  const state=secret(),transaction=secret(),verifier=secret();await db.query("INSERT INTO connector_oauth VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')",[transaction,req.actor.id,provider,hash(state),verifier]);
  const query=new URLSearchParams({client_id:client.id,redirect_uri:config.origin+'/integrations/'+provider+'/callback',response_type:'code',scope:definition.scope,state:transaction+'.'+state});
  if(provider!=='quickbooks'){query.set('access_type','offline');query.set('prompt','consent');query.set('hd','platinumbleutls.com');query.set('login_hint',req.actor.email);query.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));query.set('code_challenge_method','S256');}
  res.json({url:definition.authorize+'?'+query});
 });
 app.get('/integrations/:provider/callback',sessionMiddleware(db),async(req,res)=>{
  requirePermission(req.actor,'integration.manage');const provider=req.params.provider;if(!definitions[provider]||typeof req.query.state!=='string'||typeof req.query.code!=='string')fail(401,'Restart account connection.');
  const [transaction,state]=req.query.state.split('.');const {rows:[row]}=await db.query('DELETE FROM connector_oauth WHERE id=$1 AND member_id=$2 AND provider=$3 AND expires_at>now() RETURNING *',[transaction,req.actor.id,provider]);if(!row||row.state_hash!==hash(state||''))fail(401,'Restart account connection.');
  if(provider==='quickbooks'&&req.query.realmId!==config.qboRealmId)fail(403,'This is not the approved QuickBooks company.');
  const values={grant_type:'authorization_code',code:req.query.code,redirect_uri:config.origin+'/integrations/'+provider+'/callback'};if(provider!=='quickbooks')values.code_verifier=row.verifier;
  const tokens=await tokenRequest(provider,config,values);let account=config.qboRealmId;
  if(provider!=='quickbooks'){const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(10000)});if(!response.ok)fail(401,'Google account could not be verified.');const user=await response.json();if(user.email_verified!==true||user.hd!=='platinumbleutls.com'||user.email?.toLowerCase()!==req.actor.email)fail(403,'Connect your approved company Google account.');account=user.email.toLowerCase();}
  await tenantTx(db,req.actor,async tx=>{await tx.query('INSERT INTO connector_tokens(tenant_id,provider,encrypted,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,provider) DO UPDATE SET encrypted=excluded.encrypted,expires_at=excluded.expires_at',[req.actor.tenant_id,provider,seal(tokens,config.tokenKey),new Date(Date.now()+tokens.expires_in*1000)]);await tx.query("INSERT INTO connections(tenant_id,provider,account_id,status) VALUES($1,$2,$3,'authorized') ON CONFLICT(tenant_id,provider) DO UPDATE SET account_id=excluded.account_id,status='authorized',detail=NULL",[req.actor.tenant_id,provider,account]);await audit(tx,req.actor,'integration.authorized',null,{provider});});res.redirect('/#integrations');
 });
}
