import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOperatingCommandCenter} from '../src/notion.js';

const annotations={bold:false,italic:false,strikethrough:false,underline:false,code:false,color:'default'};
const rich=content=>[{type:'text',text:{content,link:null},annotations,plain_text:content,href:null}];
const page=({id,title,owner='Cat',status='In Progress',target='This Week',decision=false,due='2026-09-22',verified='2026-09-21',next='Do the next thing',blocker='',outcome='Keeps the operating plan moving.'})=>({
 object:'page',id,created_time:'2026-09-20T12:00:00.000Z',last_edited_time:'2026-09-21T12:00:00.000Z',archived:false,in_trash:false,
 url:`https://app.notion.com/p/${id.replaceAll('-','')}`,public_url:null,parent:{type:'data_source_id',data_source_id:'5744f794-ce07-4893-b477-4fbdc7b54a3f'},
 properties:{
  Item:{id:'title',type:'title',title:rich(title)},Owner:{id:'owner',type:'select',select:{id:'owner-id',name:owner,color:'blue'}},
  Status:{id:'status',type:'select',select:{id:'status-id',name:status,color:'orange'}},'Target Cycle':{id:'target',type:'select',select:{id:'target-id',name:target,color:'orange'}},
  'DP Decision Needed':{id:'decision',type:'checkbox',checkbox:decision},'Due Date':{id:'due',type:'date',date:due?{start:due,end:null,time_zone:null}:null},
  'Last Verified':{id:'verified',type:'date',date:verified?{start:verified,end:null,time_zone:null}:null},'Next Action':{id:'next',type:'rich_text',rich_text:rich(next)},
  'Blocker / Waiting Reason':{id:'blocker',type:'rich_text',rich_text:rich(blocker)},Outcome:{id:'outcome',type:'rich_text',rich_text:rich(outcome)},
  'Evidence State':{id:'evidence',type:'select',select:{id:'evidence-id',name:'Partial',color:'yellow'}}
 }
});
const bot={object:'user',id:'integration-bot',name:'Platinum Bleu dashboard',avatar_url:null,type:'bot',bot:{owner:{type:'workspace',workspace:true},workspace_name:'Platinum Bleu',workspace_limits:{max_file_upload_size_in_bytes:5242880}}};
const config={notionToken:'synthetic-notion-token',notionDataSource:'5744f794-ce07-4893-b477-4fbdc7b54a3f',notionWorkspace:'Platinum Bleu'};

test('Cat command center renders actionable live Notion records with explicit operating context',async()=>{
 const responses=[bot,{object:'list',results:[
  page({id:'11111111-1111-4111-8111-111111111111',title:'Prepare Week 1 commitments'}),
  page({id:'22222222-2222-4222-8222-222222222222',title:'Approve controlled test',owner:'DP',decision:true,due:'2026-09-20',next:'Approve the controlled quote-to-cash test'}),
  page({id:'33333333-3333-4333-8333-333333333333',title:'Historical completed task',status:'Done',target:'Later'})
 ],next_cursor:null,has_more:false,type:'page_or_data_source',page_or_data_source:{},request_id:'request-1'}];
 const fetchImpl=async()=>new Response(JSON.stringify(responses.shift()),{status:200,headers:{'content-type':'application/json'}});
 const result=await readOperatingCommandCenter(config,{roles:['ops'],fetchImpl,now:new Date('2026-09-21T15:00:00.000Z')});

 assert.equal(result.state,'ready');
 assert.equal(result.view,'cat');
 assert.deepEqual(result.period,{state:'operating_week',week:13,phase:'review_reset',start:'2026-09-21',end:'2026-09-26',cycle_start:'2026-06-29',cycle_end:'2026-09-26'});
 assert.deepEqual(result.summary,{actionable:2,now_or_this_week:2,blocked_or_waiting:0,dp_decisions:1,due_or_overdue:2});
 assert.equal(result.items.length,2);
 assert.equal(result.items[1].overdue,true);
 assert.equal(result.items[1].canonical_url,'https://app.notion.com/p/22222222222242228222222222222222');
 assert.equal(result.source.workspace,'Platinum Bleu');
 assert.equal(responses.length,0);
});

test('DP command center returns only DP-owned actions and decisions without technical fields',async()=>{
 const responses=[bot,{object:'list',results:[
  page({id:'11111111-1111-4111-8111-111111111111',title:'Cat action'}),
  page({id:'22222222-2222-4222-8222-222222222222',title:'Owner action',owner:'DP',next:'Approve Week 1 tactics',outcome:'The team needs one committed operating plan.'}),
  page({id:'33333333-3333-4333-8333-333333333333',title:'Owner decision',decision:true,next:'Choose the controlled test date',outcome:'The quote-to-cash workflow cannot be verified without it.'})
 ],next_cursor:null,has_more:false,type:'page_or_data_source',page_or_data_source:{},request_id:'request-2'}];
 const fetchImpl=async()=>new Response(JSON.stringify(responses.shift()),{status:200,headers:{'content-type':'application/json'}});
 const result=await readOperatingCommandCenter(config,{roles:['owner'],fetchImpl,now:new Date('2026-09-21T15:00:00.000Z')});

 assert.equal(result.state,'ready');
 assert.equal(result.view,'dp');
 assert.deepEqual(result.items.map(item=>item.action),['Approve Week 1 tactics','Choose the controlled test date']);
 assert.deepEqual(Object.keys(result.items[0]).sort(),['action','canonical_url','due_date','freshness','id','overdue','status','why_it_matters'].sort());
});

test('missing configuration and provider failures never masquerade as an empty queue',async()=>{
 const unavailable=await readOperatingCommandCenter({}, {roles:['ops'],fetchImpl:()=>assert.fail('No provider call expected'),now:new Date('2026-09-21T15:00:00.000Z')});
 assert.equal(unavailable.state,'unavailable');
 assert.equal(unavailable.items,null);
 assert.deepEqual(Object.values(unavailable.summary),[null,null,null,null,null]);

 const failed=await readOperatingCommandCenter(config,{roles:['ops'],fetchImpl:async()=>new Response(JSON.stringify({object:'error',status:401,code:'unauthorized',message:'secret detail'}),{status:401,headers:{'content-type':'application/json'}}),now:new Date('2026-09-21T15:00:00.000Z')});
 assert.equal(failed.state,'integration_error');
 assert.equal(failed.items,null);
 assert.doesNotMatch(JSON.stringify(failed),/synthetic-notion-token|secret detail/);
});

test('successful empty and stale Notion reads are distinct states',async()=>{
 const emptyResponses=[bot,{object:'list',results:[],next_cursor:null,has_more:false,type:'page_or_data_source',page_or_data_source:{},request_id:'request-empty'}];
 const empty=await readOperatingCommandCenter(config,{roles:['ops'],fetchImpl:async()=>new Response(JSON.stringify(emptyResponses.shift()),{status:200}),now:new Date('2026-09-21T15:00:00.000Z')});
 assert.equal(empty.state,'empty');
 assert.equal(empty.summary.actionable,0);
 assert.deepEqual(empty.items,[]);

 const staleResponses=[bot,{object:'list',results:[page({id:'44444444-4444-4444-8444-444444444444',title:'Old evidence',verified:'2026-09-01'})],next_cursor:null,has_more:false,type:'page_or_data_source',page_or_data_source:{},request_id:'request-stale'}];
 const stale=await readOperatingCommandCenter(config,{roles:['ops'],fetchImpl:async()=>new Response(JSON.stringify(staleResponses.shift()),{status:200}),now:new Date('2026-09-21T15:00:00.000Z')});
 assert.equal(stale.state,'stale');
 assert.equal(stale.items[0].freshness,'stale');
});

test('records without the canonical Notion parent and link fail closed',async()=>{
 const wrong=page({id:'55555555-5555-4555-8555-555555555555',title:'Wrong source'});
 wrong.parent.data_source_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 wrong.url=null;
 const responses=[bot,{object:'list',results:[wrong],next_cursor:null,has_more:false,type:'page_or_data_source',page_or_data_source:{},request_id:'request-wrong'}];
 const result=await readOperatingCommandCenter(config,{roles:['ops'],fetchImpl:async()=>new Response(JSON.stringify(responses.shift()),{status:200}),now:new Date('2026-09-21T15:00:00.000Z')});
 assert.equal(result.state,'integration_error');
 assert.equal(result.items,null);
});
