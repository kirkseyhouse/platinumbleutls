import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderCommandCenter} from '../public/command-center.js';

const period={state:'operating_week',week:13,phase:'review_reset',start:'2026-09-21',end:'2026-09-26',cycle_start:'2026-06-29',cycle_end:'2026-09-26'};
const source={system:'Notion',workspace:'Platinum Bleu',retrieved_at:'2026-09-21T15:00:00.000Z'};

test('Cat command center renders counts, evidence fields, and a safe canonical link',()=>{
 const html=renderCommandCenter({state:'ready',view:'cat',period,source,summary:{actionable:1,now_or_this_week:1,blocked_or_waiting:1,dp_decisions:1,due_or_overdue:1},items:[{
  id:'item-1',title:'<script>unsafe</script>',owner:'Cat',status:'Waiting',target_cycle:'This Week',next_action:'Confirm access',blocker:'Waiting on access',evidence_state:'Partial',last_verified:'2026-09-21',due_date:'2026-09-20',dp_decision_needed:true,why_it_matters:'Keeps work moving.',canonical_url:'https://app.notion.com/p/item-1',overdue:true,due_this_week:true,freshness:'fresh'
 }]});

 assert.match(html,/Week 13/);
 assert.match(html,/Blocked \/ waiting/);
 assert.match(html,/Waiting on access/);
 assert.match(html,/Open canonical Notion record/);
 assert.doesNotMatch(html,/<script>/);
});

test('unavailable command center renders unknown values instead of zero',()=>{
 const html=renderCommandCenter({state:'unavailable',view:'cat',period,source:{system:'Notion',workspace:null,retrieved_at:null},summary:{actionable:null,now_or_this_week:null,blocked_or_waiting:null,dp_decisions:null,due_or_overdue:null},items:null,detail:'The approved Notion connection is not configured.'});
 assert.match(html,/Notion is unavailable/);
 assert.match(html,/Unknown/);
 assert.doesNotMatch(html,/>0</);
});
