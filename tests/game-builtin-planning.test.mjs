import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {builtinSceneryDesign} from '../desktop/builtin-planning.mjs';
import {sceneryMetadata} from '../desktop/scenery-metadata.mjs';

test('every included catalogue entry supplies rules-neutral planning metadata without claiming measured height',()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL('../desktop/asset-catalog.json',import.meta.url),'utf8'));
  assert.ok(Object.keys(catalog.assets).length>=717);
  for(const [id,asset] of Object.entries(catalog.assets)){
    const design=builtinSceneryDesign(asset),metadata=design.scenery;
    assert.equal(design.purpose,'other',id);assert.doesNotThrow(()=>sceneryMetadata(metadata),id);
    assert.ok(metadata.category!=='unknown',id);assert.equal(metadata.gridMm,25.4,id);
    assert.equal(metadata.heightMm,null,id);assert.equal(metadata.floorDatumMm,null,id);
    assert.doesNotMatch(JSON.stringify(design),/dnd|warhammer|d20|armour class/i,id);
    assert.equal(metadata.widthMm,asset.connection?.width>0?asset.connection.width:null,id);
    assert.ok(metadata.tags.includes('catalogue-derived'),id);
  }
});

test('planning hints distinguish traversal and preserve unknown physical facts',()=>{
  const stair=builtinSceneryDesign({name:'Timber stairs',category:'Stairs & ramps',connection:{width:50.8,depth:25.4,height:8,ports:[{}]}}).scenery;
  assert.equal(stair.category,'stairs');assert.equal(stair.connectorSystem,'openlock');assert.ok(stair.materials.includes('wood'));
  assert.match(stair.traversal,/landing heights/);assert.equal(stair.heightMm,null);
  assert.equal(builtinSceneryDesign({name:'Wood crate',category:'Props'}).scenery.connectorSystem,'none');
});
