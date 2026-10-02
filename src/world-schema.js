export function validateWorld(p, validateScene) {
 if(p.kind!==undefined&&!['scene','world'].includes(p.kind))throw Error('Unknown project kind');
 if(p.kind!=='world'){if(p.world!==undefined)throw Error('World data requires a world project');return;}
 if(p.version!==2)throw Error('World projects require version 2.');
 const w=p.world,finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
 if(w?.placementOffset!==undefined&&!finite(w.placementOffset,-9000,10000))throw Error('Invalid level placement offset');
 if(!w||!finite(w.widthMm,203.2,10000)||!finite(w.depthMm,203.2,10000)||!Array.isArray(w.levels)||!w.levels.length||w.levels.length>32||!Array.isArray(w.instances)||w.instances.length>1000||!Array.isArray(w.encounters)||w.encounters.length>30)throw Error('Invalid world settings');
 const ids=new Set();for(const l of w.levels){if(typeof l.id!=='string'||ids.has(l.id)||typeof l.name!=='string'||l.name.length>80||!finite(l.elevation,0,9000)||typeof l.visible!=='boolean')throw Error('Invalid world level');ids.add(l.id);}
 if(!ids.has(w.activeLevel)||p.items.some(i=>!ids.has(i.levelId)))throw Error('Unknown world level');
 const groups=new Set();for(const g of w.instances){if(typeof g.id!=='string'||groups.has(g.id)||typeof g.name!=='string'||g.name.length>120)throw Error('Invalid encounter instance');groups.add(g.id);}
 if(p.items.some(i=>i.encounterId&&!groups.has(i.encounterId)))throw Error('Unknown encounter instance');
 const templates=new Set();let count=0;for(const e of w.encounters){if(typeof e.id!=='string'||templates.has(e.id)||e.scene?.kind==='world'||e.scene?.world)throw Error('Invalid encounter library');templates.add(e.id);validateScene(e.scene);count+=e.scene.items.length;}
 if(count>10000)throw Error('Encounter library exceeds 10,000 pieces');
}
