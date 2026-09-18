const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function chicagoToISO(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Enter a valid Chicago date and time.');
 const naive=Date.parse(value+':00Z');
 if(!Number.isFinite(naive)||new Date(naive).toISOString().slice(0,16)!==value)throw Error('Enter a valid calendar date.');
 const matches=[];
 for(const offset of [5,6]){const instant=new Date(naive+offset*3600000);const parts=Object.fromEntries(formatter.formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const local=`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;if(local===value)matches.push(instant.toISOString());}
 if(!matches.length)throw Error('This Chicago clock time does not exist because of daylight saving. Choose a different time.');
 if(matches.length>1)throw Error('This Chicago clock time occurs twice because of daylight saving. Choose a time outside the repeated hour.');
 return matches[0];
}
