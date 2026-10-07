import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createProjectStore} from '../desktop/project-store.cjs';
import {defaults,piece,validateProject} from '../src/model.js';
import {catalog,verifyCompatibility} from '../scripts/asset-catalog.mjs';
const project=name=>JSON.stringify({...defaults(),name,items:[piece('c-window',2.5,-3,90,12)]});
test('saving keeps an exact backup and recovery survives new app instances',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-store-'));const options={userData:path.join(root,'profile'),documents:path.join(root,'documents'),installRoot:path.join(root,'application')};await fs.mkdir(options.installRoot);const store=createProjectStore(options);await store.init();const target=path.join(store.projects,'scene.terrain'),old=project('Original'),next=project('Edited');await store.save(target,old);await store.save(target,next);assert.equal(await fs.readFile(target,'utf8'),next);const backups=await fs.readdir(store.backups);assert.equal(backups.length,1);assert.equal(await fs.readFile(path.join(store.backups,backups[0]),'utf8'),old);
 await Promise.all([store.saveRecovery(old),store.saveRecovery(next)]);const reopened=createProjectStore(options);assert.equal((await reopened.loadRecovery()).data,next);await fs.writeFile(store.recovery,'broken data');assert.equal((await reopened.loadRecovery()).data,old);assert.equal((await reopened.loadRecovery()).previous,true);
 await assert.rejects(store.save(path.join(options.installRoot,'unsafe.terrain'),old),/outside/);await assert.rejects(store.save(target,'not json'));assert.equal(await fs.readFile(target,'utf8'),next);
});
test('asset quality may change while IDs and connector layouts remain stable',()=>{
 const upgraded=structuredClone(catalog);upgraded.assets['c-window'].sha256='new-sculpt-and-material-revision';upgraded.assets['c-window'].connection.templateSource='official-provenance-only';verifyCompatibility(catalog,upgraded);
 const scene=JSON.parse(project('Saved scene')),snapshot=JSON.stringify(scene);const reopened=validateProject(JSON.parse(snapshot));assert.deepEqual(reopened,scene);assert.equal(upgraded.assets[reopened.items[0].type].sha256,'new-sculpt-and-material-revision');assert.equal(JSON.stringify(scene),snapshot);assert.equal(scene.assets,undefined);
 delete upgraded.assets['c-window'];assert.throws(()=>verifyCompatibility(catalog,upgraded),/Retain its ID/);const incompatible=structuredClone(catalog);incompatible.assets['c-window'].connection.ports[0].x+=1;assert.throws(()=>verifyCompatibility(catalog,incompatible),/Connection layout changed/);
});
test('embedded imported models remain unchanged when the built-in library updates',()=>{
 const scene=defaults();scene.assets={'u-fixture':{name:'Personal mesh',positions:[0,0,0,1,0,0,0,1,0],colors:[1,1,1,1,1,1,1,1,1],indices:[0,1,2]}};scene.items=[piece('u-fixture',3,4)];assert.deepEqual(validateProject(JSON.parse(JSON.stringify(scene))),scene);
});

test('project catalogue separates worlds and scenes, discovers legacy files, and loads only contained matching projects',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-project-catalog-')),documents=path.join(root,'Documents'),userData=path.join(root,'Profile'),installRoot=path.join(root,'Install');
 try{
  const store=createProjectStore({userData,documents,installRoot});await store.init();await fs.mkdir(path.join(store.projects,'Worlds'),{recursive:true});await fs.mkdir(path.join(store.projects,'Encounters'),{recursive:true});
  const world={version:2,kind:'world',name:'Moonlit Reach',items:[]},scene={version:1,kind:'scene',name:'Old Chapel',items:[]};
  await fs.writeFile(path.join(store.projects,'Worlds','Reach.terrain'),JSON.stringify(world));
  await fs.writeFile(path.join(store.projects,'Encounters','Chapel.terrain'),JSON.stringify(scene));
  await fs.writeFile(path.join(store.projects,'Legacy Scene.terrain'),JSON.stringify(scene));
  const worlds=await store.listProjects('world'),scenes=await store.listProjects('scene');
  assert.deepEqual(worlds.map(x=>x.name),['Moonlit Reach']);assert.deepEqual(scenes.map(x=>x.name).sort(),['Old Chapel','Old Chapel']);
  assert.equal(JSON.parse((await store.loadProject('Worlds/Reach.terrain','world')).data).kind,'world');
  await assert.rejects(store.loadProject('../Install/secret.terrain','world'),/Invalid saved project/);
  await assert.rejects(store.loadProject('Encounters/Chapel.terrain','world'),/Invalid saved project|different workspace/);
  await assert.rejects(store.listProjects('campaign'),/Choose a world or encounter folder/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
