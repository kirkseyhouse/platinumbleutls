import express from 'express';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {hash} from './auth.js';
import {tenantTx} from './db.js';
import {fail} from './domain.js';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function verifyHmac(body,signature,key){if(!key||typeof signature!=='string'||!Buffer.isBuffer(body))return false;const expected=createHmac('sha256',key).update(body).digest();const received=Buffer.from(signature,'base64');return received.length===expected.length&&timingSafeEqual(expected,received);}
function jsonBody(body){try{return JSON.parse(body.toString());}catch{fail(400,'Invalid notification.');}}
export function webhookRoutes(app,{db,config}){
 const accept=async(provider,key,body)=>{if(!db||!config.tenantId)fail(503,'Webhook connection is unavailable.');await tenantTx(db,{tenant_id:config.tenantId},tx=>tx.query('INSERT INTO webhook_inbox(tenant_id,provider,event_key,body) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[config.tenantId,provider,key,JSON.stringify(body)]));};
 app.post('/webhooks/quickbooks',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
  if(!verifyHmac(req.body,req.headers['intuit-signature'],config.qboWebhookKey))fail(401,'Invalid notification signature.');const body=jsonBody(req.body);
  if(!Array.isArray(body.eventNotifications)||!body.eventNotifications.length||!config.qboRealmId||body.eventNotifications.some(n=>n.realmId!==config.qboRealmId))fail(400,'Unexpected company or notification contract.');
  await accept('quickbooks',hash(req.body),body);res.status(204).end();
 });
 app.post('/webhooks/gmail',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
  if(!config.pubsubAudience||!config.pubsubServiceAccount)fail(503,'Pub/Sub verification is not configured.');const bearer=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!bearer)fail(401,'Verified Pub/Sub identity required.');
  const {payload}=await jwtVerify(bearer,jwks,{issuer:['https://accounts.google.com','accounts.google.com'],audience:config.pubsubAudience,algorithms:['RS256']});if(payload.email!==config.pubsubServiceAccount||payload.email_verified!==true)fail(401,'Unexpected Pub/Sub identity.');
  const body=jsonBody(req.body);if(!body.message?.messageId||!body.message?.data)fail(400,'Invalid Pub/Sub envelope.');const message=jsonBody(Buffer.from(body.message.data,'base64'));const connection=await tenantTx(db,{tenant_id:config.tenantId},tx=>tx.query("SELECT account_id FROM connections WHERE tenant_id=$1 AND provider='gmail'",[config.tenantId]));if(message.emailAddress!==connection.rows[0]?.account_id)fail(403,'Unexpected mailbox.');await accept('gmail',body.message.messageId,{historyId:message.historyId});res.status(204).end();
 });
}
