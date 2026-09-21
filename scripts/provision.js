import {createDatabase} from '../src/db.js';
import {roleNames} from '../src/domain.js';
const [email,name,role]=process.argv.slice(2);
if(!email||email!==email.toLowerCase()||!/^[^@]+@platinumbleutls\.com$/.test(email)||!name||!roleNames.includes(role))throw new Error('Usage: npm run provision -- company-email "Full name" owner|ops|bookkeeper|estimator|crew|subcontractor');
const db=await createDatabase({env:process.env,purpose:'migration'});if(!db)throw new Error('Set the database configuration first.');
try{await db.tx(async tx=>{let tenant=process.env.TENANT_ID;if(!tenant){const result=await tx.query('SELECT id FROM tenants');if(result.rows.length>1)throw new Error('Specify TENANT_ID.');tenant=result.rows[0]?.id;if(!tenant)tenant=(await tx.query("INSERT INTO tenants(name,domain) VALUES('Platinum Bleu Tree & Land Services','platinumbleutls.com') RETURNING id")).rows[0].id;}
 await tx.query('INSERT INTO members(tenant_id,email,name,roles) VALUES($1,$2,$3,$4)',[tenant,email,name,[role]]);await tx.query("select set_config('app.tenant_id',$1,true)",[tenant]);await tx.query("INSERT INTO audit_events(tenant_id,action,detail) VALUES($1,'member.provisioned',$2)",[tenant,JSON.stringify({email,role})]);console.log('Membership provisioned. Tenant: '+tenant);});}finally{await db.close();}
