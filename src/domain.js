export class Problem extends Error {
  constructor(status,message){super(message);this.status=status;}
}
export const fail=(status,message)=>{throw new Problem(status,message);};
const grants={
  owner:['command.read','customer.read','customer.write','job.read','job.write','job.schedule','job.status','job.approve','lead.read','lead.write','invoice.read','invoice.write','invoice.approve','document.read','document.write','resource.read','resource.write','member.manage','integration.read','integration.manage','audit.read'],
  ops:['command.read','customer.read','customer.write','job.read','job.write','job.schedule','job.status','lead.read','lead.write','invoice.read','invoice.write','document.read','document.write','resource.read','resource.write','integration.read'],
  bookkeeper:['customer.read','job.read','invoice.read','invoice.write','document.read','integration.read','audit.read'],
  estimator:['customer.read','job.read','lead.read','lead.write','document.read','document.write'],
  crew:['job.read','job.status','document.read','document.write'],
  subcontractor:['job.read','job.status','document.read','document.write'],
};
export const roleNames=Object.keys(grants);
export const allowed=(roles,permission)=>roles.some(r=>grants[r]?.includes(permission));
export const requirePermission=(actor,p)=>{if(!allowed(actor.roles,p)) fail(403,'You do not have permission for this action.');};
export const restricted=actor=>actor.roles.every(r=>['crew','subcontractor','estimator'].includes(r));
export function validateIdentity(claims){
  const email=claims.email?.trim().toLowerCase();
  if(typeof claims.sub!=='string'||!claims.sub || !['https://accounts.google.com','accounts.google.com'].includes(claims.iss) || claims.email_verified!==true || claims.hd!=='platinumbleutls.com' || !email || email.split('@').length!==2 || email.split('@')[1]!=='platinumbleutls.com') fail(403,'An approved platinumbleutls.com Google Workspace account is required.');
  return {email,subject:claims.sub,issuer:'https://accounts.google.com'};
}
export function normalizeContact({email,phone}){
  email=email?.trim().toLowerCase()||null;
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422,'Enter a valid email address.');
  if(phone){let digits=phone.replace(/\D/g,'');if(digits.length===10)digits='1'+digits;if(!/^[1-9]\d{7,14}$/.test(digits))fail(422,'Enter a valid phone with country code.');phone='+'+digits;}else phone=null;
  return {email,phone};
}
export function calculateInvoice(lines){
  if(!Array.isArray(lines)||!lines.length||lines.length>100)fail(422,'Add 1–100 invoice lines.');
  let total=0;
  for(const l of lines){if(!Number.isSafeInteger(l.quantity)||l.quantity<1||!Number.isSafeInteger(l.unit_minor)||l.unit_minor<0||!Number.isSafeInteger(l.tax_minor)||l.tax_minor<0)fail(422,'Use whole quantities and nonnegative integer cents.');total+=l.quantity*l.unit_minor+l.tax_minor;if(!Number.isSafeInteger(total))fail(422,'Invoice amount is too large.');}
  return total;
}
export function scheduleGate(job){
  if(!job.approved_at||!job.agreement_at)fail(422,'Owner approval and accepted agreement are required before scheduling.');
  if(job.deposit_required_minor===null||Number(job.deposit_paid_minor)<Number(job.deposit_required_minor))fail(422,'Confirm the required deposit before scheduling.');
}
