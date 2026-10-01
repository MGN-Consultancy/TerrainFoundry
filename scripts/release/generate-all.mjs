import {spawnSync}from'node:child_process';import fs from'node:fs/promises';
await fs.mkdir('src/generated',{recursive:true});await fs.mkdir('test-results',{recursive:true});await fs.mkdir('public/dungeon-range',{recursive:true});
if(!await fs.stat('src/generated/openlock.json').catch(()=>null))await fs.writeFile('src/generated/openlock.json','{}');
for(const script of ['generate-official-socket.mjs','generate-village.mjs','generate-blacksmith.mjs','generate-dungeon.mjs','generate-benchmarks.mjs','generate-expansions.mjs','generate-outdoor.mjs','generate-caves.mjs','generate-grotto.mjs','generate-woodland.mjs','generate-clip.mjs','generate-openlock.mjs']){const r=spawnSync(process.execPath,['scripts/'+script],{stdio:'inherit'});if(r.status)process.exit(r.status||1);}
// The ranges use committed original shape metadata, never a commercial asset catalogue.
for(const [script,args]of [['generate-dungeon-range.mjs',['--force']],['generate-curves.mjs',['--force']],['release/asset-packs.mjs',[]]]){const r=spawnSync(process.execPath,['scripts/'+script,...args],{stdio:'inherit'});if(r.status)process.exit(r.status||1);}
