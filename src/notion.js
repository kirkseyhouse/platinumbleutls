const api='https://api.notion.com/v1';
const version='2026-03-11';
const workspaceName='Platinum Bleu';
const cycleAnchor='2026-09-28';

const isoDate=date=>date.toISOString().slice(0,10);
const addDays=(date,days)=>{const copy=new Date(date);copy.setUTCDate(copy.getUTCDate()+days);return copy;};
const dateInChicago=now=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
};
export function operatingPeriod(now=new Date()){
 const today=dateInChicago(now),anchor=new Date(cycleAnchor+'T00:00:00.000Z');
 const elapsed=Math.round((today-anchor)/86400000),cycleIndex=Math.floor(elapsed/91),cycleStart=addDays(anchor,cycleIndex*91),offset=Math.round((today-cycleStart)/86400000);
 const week=Math.floor(offset/7)+1,day=offset%7;
 if(day===6)return {state:'between_weeks',week:null,phase:'sunday_reset',start:null,end:null,cycle_start:isoDate(cycleStart),cycle_end:isoDate(addDays(cycleStart,89))};
 const start=addDays(cycleStart,(week-1)*7);
 return {state:'operating_week',week,phase:week===13?'review_reset':'execute',start:isoDate(start),end:isoDate(addDays(start,5)),cycle_start:isoDate(cycleStart),cycle_end:isoDate(addDays(cycleStart,89))};
}

const text=property=>property?.[property.type]?.map?.(part=>part.plain_text||'').join('').trim()||'';
const select=property=>property?.select?.name||null;
const date=property=>property?.date?.start?.slice(0,10)||null;
const checkbox=property=>property?.checkbox===true;
const dayNumber=value=>value?Date.parse(value+'T00:00:00.000Z'):null;
function normalize(page,today,period){
 const properties=page.properties||{},due=date(properties['Due Date']),verified=date(properties['Last Verified']);
 const status=select(properties.Status),target=select(properties['Target Cycle']),blocker=text(properties['Blocker / Waiting Reason']),decision=checkbox(properties['DP Decision Needed']);
 const todayNumber=dayNumber(today),dueNumber=dayNumber(due),periodEnd=dayNumber(period.end);
 return {
  id:page.id,title:text(properties.Item)||'Untitled Notion item',owner:select(properties.Owner),status,target_cycle:target,
  next_action:text(properties['Next Action'])||null,blocker:blocker||null,evidence_state:select(properties['Evidence State']),last_verified:verified,due_date:due,
  dp_decision_needed:decision,why_it_matters:text(properties.Outcome)||null,canonical_url:page.url||null,
  overdue:dueNumber!==null&&dueNumber<todayNumber,due_this_week:dueNumber!==null&&periodEnd!==null&&dueNumber<=periodEnd,
  freshness:verified?(todayNumber-dayNumber(verified)>7*86400000?'stale':'fresh'):'unknown'
 };
}
const isActive=item=>!['Done','Parked'].includes(item.status);
const isActionable=item=>isActive(item)&&(['Now','This Week'].includes(item.target_cycle)||item.status==='Waiting'||item.blocker||item.dp_decision_needed||item.due_this_week||item.overdue);
const unknown=(state,view,period,detail)=>({state,view,period,summary:{actionable:null,now_or_this_week:null,blocked_or_waiting:null,dp_decisions:null,due_or_overdue:null},items:null,source:{system:'Notion',workspace:null,retrieved_at:null},detail});

async function request(url,token,options,fetchImpl){
 const response=await fetchImpl(url,{...options,headers:{authorization:`Bearer ${token}`,'notion-version':version,accept:'application/json','content-type':'application/json',...options?.headers},signal:AbortSignal.timeout(20000)});
 if(!response.ok){const error=new Error('Notion request failed');error.status=response.status;error.retryAfter=response.headers.get('retry-after');throw error;}
 return response.json();
}

export async function readOperatingCommandCenter(config,{roles=[],fetchImpl=fetch,now=new Date()}={}){
 const view=roles.includes('owner')?'dp':'cat',period=operatingPeriod(now);
 if(!config?.notionToken||!config?.notionDataSource)return unknown('unavailable',view,period,'The approved Notion connection is not configured.');
 try{
  const identity=await request(api+'/users/me',config.notionToken,{},fetchImpl);
  const expected=config.notionWorkspace||workspaceName;
  if(identity.type!=='bot'||identity.bot?.workspace_name!==expected)throw new Error('Notion workspace identity mismatch');
  const pages=[];let cursor=null;
  for(let pageNumber=0;pageNumber<20;pageNumber++){
   const body={page_size:100};if(cursor)body.start_cursor=cursor;
   const result=await request(`${api}/data_sources/${encodeURIComponent(config.notionDataSource)}/query`,config.notionToken,{method:'POST',body:JSON.stringify(body)},fetchImpl);
   if(!Array.isArray(result.results))throw new Error('Unexpected Notion response');
   for(const page of result.results){if(page?.object==='page'&&(page.parent?.data_source_id!==config.notionDataSource||typeof page.url!=='string'||!page.url))throw new Error('Unexpected Notion record source');pages.push(page);}
   if(!result.has_more){cursor=null;break;}if(!result.next_cursor)throw new Error('Incomplete Notion pagination');cursor=result.next_cursor;
   if(pageNumber===19)throw new Error('Notion result exceeds the retrieval limit');
  }
  const today=isoDate(dateInChicago(now)),all=pages.filter(page=>page?.object==='page').map(page=>normalize(page,today,period));
  const actionable=all.filter(isActionable);
  const selected=view==='dp'?actionable.filter(item=>item.owner==='DP'||item.dp_decision_needed).map(item=>({id:item.id,action:item.next_action||item.title,due_date:item.due_date,why_it_matters:item.why_it_matters,status:item.status,canonical_url:item.canonical_url,overdue:item.overdue,freshness:item.freshness})):actionable;
  const stale=selected.some(item=>item.freshness==='stale');
  return {
   state:selected.length?(stale?'stale':'ready'):'empty',view,period,
   summary:{actionable:selected.length,now_or_this_week:selected.filter(item=>view==='dp'||['Now','This Week'].includes(item.target_cycle)).length,blocked_or_waiting:selected.filter(item=>view==='cat'&&(item.status==='Waiting'||item.blocker)).length,dp_decisions:selected.filter(item=>view==='cat'?item.dp_decision_needed:true).length,due_or_overdue:selected.filter(item=>item.overdue||(view==='cat'&&item.due_this_week)||(view==='dp'&&item.due_date)).length},
   items:selected,source:{system:'Notion',workspace:expected,retrieved_at:now.toISOString(),data_source_id:config.notionDataSource}
  };
 }catch(error){return unknown('integration_error',view,period,error.status===429?'Notion is rate limited. Try again after the provider window resets.':'Live Notion data could not be verified.');}
}
