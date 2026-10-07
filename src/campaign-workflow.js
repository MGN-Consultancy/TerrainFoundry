const actionKey=action=>{
 if(action.type==='upsertRecord')return action.type+':'+(action.collection||'')+':'+(action.record?.id||action.record?.name||action.record?.title||JSON.stringify(action.record||{}));
 if(action.type==='updateBrief')return action.type;
 if(['editLinkedProject','addWorldPieces','openLinkedProject'].includes(action.type))return action.type+':'+action.id;
 if(action.type==='linkSavedScene')return action.type+':'+action.id;
 if(action.type==='writeWorkspaceFile')return action.type+':'+action.path;
 if(action.type==='createArtwork')return action.type+':'+(action.target||'cover')+':'+(action.title||'');
 if(action.type==='buildWorld')return action.type+':'+(action.name||'');
 if(action.type==='proposeEncounter')return action.type+':'+(action.layout?.name||'');
 return action.type+':'+JSON.stringify(action);
};
export function queueCampaignAction(current,action){if(!action||typeof action.type!=='string')throw Error('Invalid campaign proposal');if(action.type==='updateBrief')return {actions:current.filter(x=>x.type!=='updateBrief'),draftBrief:action.brief||null};const key=actionKey(action),actions=current.filter(x=>actionKey(x)!==key);actions.push(structuredClone(action));return {actions:actions.filter(x=>x.type!=='updateBrief').slice(-5),draftBrief:null};}
export function sectionForCampaignAction(action){if(action.type==='upsertRecord')return action.collection==='characters'?'Characters':action.collection==='relationships'?'Connections':action.collection==='timeline'?'Timeline':action.collection==='notes'?'Notes':'Items';if(['buildWorld','addWorldPieces','proposeEncounter','linkSavedScene','chooseProjectFile','openLinkedProject','editLinkedProject'].includes(action.type))return 'Linked projects';if(action.type==='createArtwork')return action.target==='map'?'Maps':'Story';if(action.type==='updateBrief')return 'Story';if(['writeWorkspaceFile','updateSharedStyle'].includes(action.type))return 'Notes';return null;}
