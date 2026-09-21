const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const formatDate=value=>value?new Date(value+'T12:00:00.000Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Chicago'}):'Unknown';
const count=value=>value===null||value===undefined?'Unknown':String(value);
const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};
const stateCopy={
 unavailable:['Notion is unavailable','The dashboard cannot establish the current queue until its approved read-only connection is configured.'],
 integration_error:['Notion integration error','Live Notion data could not be verified. No empty or zero state is being inferred.'],
 stale:['Notion evidence is stale','Live records loaded, but at least one item has not been verified within seven days.'],
 empty:['No actionable Notion items','The live read succeeded and found no current Now, This Week, blocked, decision, or due items.']
};
const periodLabel=period=>period?.state==='operating_week'?`Week ${period.week} · ${formatDate(period.start)}–${formatDate(period.end)} · ${period.phase==='review_reset'?'Review + reset':'Execute'}`:'Sunday · outside the Monday–Saturday operating week';
const metric=(label,value,note)=>`<div class="stat"><label>${esc(label)}</label><strong>${esc(count(value))}</strong><small>${esc(note)}</small></div>`;
const link=item=>{const url=safeUrl(item.canonical_url);return url?`<a class="button secondary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open canonical Notion record ↗</a>`:'<span class="muted">Canonical link unavailable</span>';};
function statusBanner(data){
 if(data.state==='ready')return '';
 const [heading,body]=stateCopy[data.state]||stateCopy.integration_error;
 return `<div class="command-state ${esc(data.state)}" role="status"><strong>${esc(heading)}</strong><p>${esc(data.detail||body)}</p></div>`;
}
function catItems(items){
 if(!items?.length)return '';
 return `<div class="command-list">${items.map(item=>`<article class="command-item"><div class="command-item-top"><div><span class="eyebrow">${esc(item.target_cycle||'Cycle unknown')}</span><h3>${esc(item.title)}</h3></div><span class="badge ${item.overdue?'red':item.status==='Waiting'?'amber':'blue'}">${esc(item.overdue?'Overdue':item.status||'Unknown status')}</span></div><dl><div><dt>Owner</dt><dd>${esc(item.owner||'Unknown')}</dd></div><div><dt>Due</dt><dd>${esc(formatDate(item.due_date))}</dd></div><div><dt>Next action</dt><dd>${esc(item.next_action||'Unknown')}</dd></div><div><dt>Blocked / waiting</dt><dd>${esc(item.blocker||'No blocker recorded')}</dd></div><div><dt>Evidence</dt><dd>${esc(item.evidence_state||'Unknown')} · verified ${esc(formatDate(item.last_verified))}</dd></div></dl>${link(item)}</article>`).join('')}</div>`;
}
function dpItems(items){
 if(!items?.length)return '';
 return `<div class="command-list">${items.map(item=>`<article class="command-item dp-action"><div class="command-item-top"><h3>${esc(item.action)}</h3><span class="badge ${item.overdue?'red':'blue'}">${esc(item.overdue?'Overdue':item.status||'Action')}</span></div><p><strong>Due:</strong> ${esc(formatDate(item.due_date))}</p><p><strong>Why it matters:</strong> ${esc(item.why_it_matters||'Unknown')}</p>${link(item)}</article>`).join('')}</div>`;
}
export function renderCommandCenter(data){
 const isCat=data.view==='cat',description=isCat?'Live operating commitments, exceptions, decisions, and evidence from the canonical Notion record.':'Only the decisions and next actions DP owns, from the canonical Notion record.';
 const metrics=isCat?[
  ['Actionable',data.summary?.actionable,'Current live items'],['Now / This Week',data.summary?.now_or_this_week,'Committed cycle'],['Blocked / waiting',data.summary?.blocked_or_waiting,'Needs movement'],['DP decisions',data.summary?.dp_decisions,'Owner input'],['Due / overdue',data.summary?.due_or_overdue,'Date-based attention']
 ]:[['Your actions',data.summary?.actionable,'DP-owned only'],['Due / overdue',data.summary?.due_or_overdue,'Date-based attention']];
 return `<div class="page-top"><div><span class="eyebrow">PLATINUM BLEU / OPERATING COMMAND CENTER</span><h1>${isCat?'Cat · operating view':'DP · decision view'}</h1><p>${esc(description)}</p></div></div><div class="banner command-period"><strong>${esc(periodLabel(data.period))}</strong><p>12 Week Year cycle: ${esc(formatDate(data.period?.cycle_start))}–${esc(formatDate(data.period?.cycle_end))}</p></div>${statusBanner(data)}<div class="stats command-stats">${metrics.map(metricArgs=>metric(...metricArgs)).join('')}</div>${isCat?catItems(data.items):dpItems(data.items)}<p class="source-label">Source: live Notion read · workspace ${esc(data.source?.workspace||'Unknown')} · retrieved ${esc(data.source?.retrieved_at?new Date(data.source.retrieved_at).toLocaleString('en-US',{timeZone:'America/Chicago'}):'Unknown')}</p>`;
}
