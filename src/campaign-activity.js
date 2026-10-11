const LABELS={thinking:'Thinking',working:'Working',image:'Creating concept',model:'Building model',connecting:'Connecting voice',listening:'Listening',speaking:'Speaking',dictation:'Dictation on'};
export function activityPresentation(states){
 const entries=[...states].map(([source,value])=>({source,...value}));
 const current=entries.filter(item=>item.active).sort((a,b)=>b.order-a.order)[0] || entries.sort((a,b)=>b.order-a.order)[0];
 return current?{phase:current.phase,active:!!current.active,label:current.label||LABELS[current.phase]||'Working',detail:current.detail||''}:{phase:'ready',active:false,label:'Ready',detail:'Tell me what you want to create.'};
}
/** One activity view within the shared companion; it reflects real request lifecycle events. */
export function setupCampaignActivity(assistant){
 const states=new Map();let order=0;const node=document.createElement('div');node.id='campaign-activity';node.className='campaign-activity';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
 node.innerHTML='<svg class="campaign-activity-form" viewBox="0 0 180 90" aria-hidden="true"><defs><linearGradient id="campaign-activity-colour"><stop stop-color="#7bd3c1"/><stop offset="1" stop-color="#e8be7c"/></linearGradient></defs><g class="campaign-activity-orbit"><ellipse cx="90" cy="45" rx="61" ry="26"/><ellipse cx="90" cy="45" rx="45" ry="34" transform="rotate(-22 90 45)"/><ellipse cx="90" cy="45" rx="67" ry="14" transform="rotate(14 90 45)"/></g><g class="campaign-activity-core"><path d="M60 45Q70 18 90 27T120 45Q109 72 90 62T60 45Z"/><path d="M72 45Q80 30 90 35T108 45Q101 60 90 55T72 45Z"/></g><g class="campaign-activity-points"><circle cx="30" cy="43" r="2"/><circle cx="145" cy="32" r="2"/><circle cx="105" cy="14" r="1.5"/></g></svg><div class="campaign-activity-copy"><strong></strong><span></span></div>';
 assistant.querySelector('header').after(node);
 function render(){const value=activityPresentation(states);node.dataset.phase=value.phase;node.dataset.active=String(value.active);node.querySelector('strong').textContent=value.label;node.querySelector('span').textContent=value.detail;node.setAttribute('aria-busy',String(value.active));}
 function set(source,value){if(!value){states.delete(source);}else states.set(source,{...value,order:++order});render();}
 function progress(value){const source=states.has('creative:'+value.id)?'creative:'+value.id:states.has('voice-tool')?'voice-tool':null;if(!source)return;const current=states.get(source),detail=String(value.phase||'Working')+(Number.isFinite(value.percent)?' · '+Math.max(0,Math.min(100,value.percent))+'%':'');set(source,{...current,detail});}
 render();return {set,end:source=>set(source,null),has:source=>states.has(source),progress,node};
}
