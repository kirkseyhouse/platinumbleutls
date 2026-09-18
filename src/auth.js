import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { validateIdentity, fail } from './domain.js';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').filter(s=>s.includes('=')).map(s=>{const at=s.indexOf('=');return[s.slice(0,at).trim(),s.slice(at+1)];}));
const cookieOptions={secure:true,httpOnly:true,sameSite:'lax',path:'/'};
const JWKS=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function authRoutes(app,{db,config}){
  app.get('/auth/google',async(req,res)=>{
    if(!db||!config.googleClientId||!config.googleClientSecret||!config.origin)fail(503,'Google Workspace sign-in is awaiting owner configuration.');
    const id=secret(),state=secret(),nonce=secret(),verifier=secret();
    await db.query("INSERT INTO login_transactions VALUES($1,$2,$3,$4,now()+interval '10 minutes')",[hash(id),hash(state),nonce,verifier]);
    res.cookie('__Host-pb_login',id,{...cookieOptions,maxAge:600000});
    const params=new URLSearchParams({client_id:config.googleClientId,redirect_uri:config.origin+'/auth/google/callback',response_type:'code',scope:'openid email',state,nonce,hd:'platinumbleutls.com',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?'+params);
  });
  app.get('/auth/google/callback',async(req,res)=>{
    if(!db||!config.googleClientId||!config.googleClientSecret)fail(503,'Sign-in configuration is unavailable.');
    const id=cookies(req)['__Host-pb_login'];
    if(!id||typeof req.query.state!=='string'||typeof req.query.code!=='string')fail(401,'Restart sign-in.');
    const {rows:[login]}=await db.query('DELETE FROM login_transactions WHERE id=$1 AND expires_at>now() RETURNING *',[hash(id)]);
    res.clearCookie('__Host-pb_login',cookieOptions);
    if(!login||!equal(login.state_hash,hash(req.query.state)))fail(401,'Restart sign-in.');
    const result=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:req.query.code,client_id:config.googleClientId,client_secret:config.googleClientSecret,redirect_uri:config.origin+'/auth/google/callback',grant_type:'authorization_code',code_verifier:login.verifier}),signal:AbortSignal.timeout(15000)});
    if(!result.ok)fail(401,'Google sign-in could not be verified.');
    const tokens=await result.json();
    const {payload}=await jwtVerify(tokens.id_token,JWKS,{issuer:['https://accounts.google.com','accounts.google.com'],audience:config.googleClientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce','email','email_verified','hd']});
    if(!equal(payload.nonce,login.nonce)||(payload.azp&&payload.azp!==config.googleClientId))fail(401,'Google sign-in could not be verified.');
    const identity=validateIdentity(payload);
    const token=secret(),csrf=secret();
    await db.tx(async tx=>{
      const {rows:[member]}=await tx.query("SELECT * FROM members WHERE email=$1 AND status='active' FOR UPDATE",[identity.email]);
      if(!member||(member.subject&&member.subject!==identity.subject))fail(403,'Your company account needs an approved membership.');
      await tx.query('UPDATE members SET subject=$1 WHERE id=$2',[identity.subject,member.id]);
      await tx.query("INSERT INTO sessions(token_hash,member_id,csrf,permission_version,expires_at) VALUES($1,$2,$3,$4,now()+interval '12 hours')",[hash(token),member.id,csrf,member.permission_version]);
      await tx.query("select set_config('app.tenant_id',$1,true)",[member.tenant_id]);
      await tx.query("INSERT INTO audit_events(tenant_id,actor_id,action) VALUES($1,$2,'session.login')",[member.tenant_id,member.id]);
    });
    res.cookie('__Host-pb_session',token,{...cookieOptions,maxAge:12*3600*1000});res.redirect('/');
  });
}
export function sessionMiddleware(db){return async(req,res,next)=>{
  if(!db)fail(503,'The secure database is not configured.');
  const token=cookies(req)['__Host-pb_session'];if(!token)fail(401,'Sign in with your company Google account.');
  const {rows:[actor]}=await db.query("SELECT m.*,s.csrf FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.seen_at>now()-interval '30 minutes' AND m.status='active' AND s.permission_version=m.permission_version",[hash(token)]);
  if(!actor)fail(401,'Your session has expired or access has been revoked.');
  await db.query('UPDATE sessions SET seen_at=now() WHERE token_hash=$1',[hash(token)]);req.actor=actor;req.sessionHash=hash(token);next();
};}
export function csrfMiddleware(config){return(req,res,next)=>{
  if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
  if(req.headers.origin!==config.origin||!equal(req.headers['x-csrf-token'],req.actor.csrf))fail(403,'Reload this page before submitting.');next();
};}
